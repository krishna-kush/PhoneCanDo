package com.phonecando.runner.update

import android.content.Context
import com.phonecando.network.android.NetworkState
import com.phonecando.network.download.ExpectedFile
import com.phonecando.network.download.FileDownloader
import com.phonecando.network.download.HashCheckpoints
import com.phonecando.network.download.RangeOpener
import com.phonecando.network.http.UrlConnectionPort
import com.phonecando.network.retry.ResumeList
import com.phonecando.network.retry.RetryLoop
import com.phonecando.network.retry.RetryPolicy
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * PhoneCanDo's own update APK, downloaded by us, one per process: at most
 * one download at a time into `files/updates/` (UpdatePaths), on network's
 * FileDownloader (a `.part` resumed with `Range`, size and sha256 checked
 * before it becomes the APK) under its RetryLoop (a dropped connection or a
 * server error waits and goes on, no network waits for one). The record in
 * `files/state/update-download.json` (UpdateStore) and the resume list say
 * what to carry on after a process death: [recoverOnce] does, once per
 * process, after it cleans what an install left. Our jobs anchor keeps the
 * foreground service up while one runs ([running], listeners). Every change
 * goes to the app as the phonecandoUpdateDownload event (UpdateEvents).
 *
 * Starts and stops never hold [lock] while they wait, and nothing calls the
 * job's reporter while holding it (the reporter tells listeners, which read
 * [running]).
 */
class UpdateDownloads private constructor(context: Context) {
  /** The download began, moved on or ended. */
  fun interface Listener {
    fun onUpdate()
  }

  private val app: Context = context.applicationContext ?: context
  private val paths = UpdatePaths(app.filesDir)
  private val store = UpdateStore(paths.record)
  private val resumeList = ResumeList(paths.resumeList)
  private val network = NetworkState(app)
  private val http = UrlConnectionPort(userAgent = "phonecando-update")
  private val checkpoints = HashCheckpoints()
  private val retries = RetryLoop(online = network::online)
  private val listeners = CopyOnWriteArrayList<Listener>()
  private val recovered = AtomicBoolean(false)
  private val lock = Any()

  // The job running or, discarded, still ending (a start of the same file
  // waits for it); and how many stops there were, so a start that waited
  // across a stop does not begin.
  private var job: UpdateJob? = null
  private var stops = 0L

  /** Our own threads: a download takes minutes, and a start may wait for a stopped one to end. */
  val executor: ExecutorService = Executors.newCachedThreadPool { task ->
    Thread(task, "phonecando-update").apply { isDaemon = true }
  }

  fun addListener(listener: Listener) = listeners.addIfAbsent(listener)

  fun removeListener(listener: Listener) = listeners.remove(listener)

  /** The running download's state, or null (a discarded one still ending does not count). */
  fun running(): UpdateState? = liveJob()?.reporter?.current

  /** The running download's state, else the record's; null with no record (a done one whose APK is gone is dropped). */
  fun state(): UpdateState? {
    liveJob()?.let { return it.reporter.current }
    return synchronized(lock) {
      val record = store.load() ?: return@synchronized null
      val apk = paths.apk(record.spec.name)
      val apkLength = if (apk.isFile) apk.length() else null
      val state = UpdateState.ofRecord(record, apk.absolutePath, apkLength, paths.part(record.spec.name).lengthOrZero())
      if (state == null) drop(record)
      state
    }
  }

  /**
   * Starts downloading [spec], or says where it is: the same spec running
   * gives its state, its APK already finished gives `done` at once. Another
   * spec's download is stopped, and its files go, first. Waits for a
   * stopped job to end, so call it on [executor].
   * @throws UpdateError busy when the last one did not stop in time,
   *   stopped when a stop came while it waited
   * @throws java.io.IOException when the record cannot be written
   */
  fun start(spec: UpdateSpec): UpdateState {
    val (old, seen) = synchronized(lock) { job to stops }
    if (old != null) {
      if (old.spec == spec && !old.isDiscarded) return old.reporter.current
      if (old.discard()) stopped(old)
      if (!old.await(STOP_WAIT_MS)) throw UpdateError(UpdateErrors.BUSY, "the last download did not stop in time")
    }
    val begun = synchronized(lock) {
      if (stops != seen) throw UpdateError(UpdateErrors.STOPPED, "stopped before it began")
      job?.let { now ->
        if (now.spec == spec && !now.isDiscarded) return@synchronized now
        throw UpdateError(UpdateErrors.BUSY, "another download is starting")
      }
      val record = store.load()
      val apk = paths.apk(spec.name)
      val same = record != null && record.spec == spec
      if (same && record?.step == UpdateStep.DONE && apk.isFile && apk.length() == spec.size) {
        return UpdateState(spec, UpdateStep.DONE, spec.size, apk.absolutePath)
      }
      val resumable = same && record?.step != UpdateStep.DONE
      record?.let { if (it.spec.name != spec.name) resumeList.remove(it.spec.name) }
      wipe { CleanRules.keptOnStart(it, spec.name, resumable) }
      store.save(UpdateRecord(spec, UpdateStep.DOWNLOAD))
      begin(spec)
    }
    return begun.reporter.current
  }

  /** Stops the download and drops all of it: the job, its `.part` or finished APK, the record and the resume entry. Never waits. */
  fun stop() {
    val live = synchronized(lock) {
      stops++
      val live = job?.takeIf { it.discard() }
      // What the job may still write as it ends, it deletes itself (runJob).
      wipe { false }
      store.delete()
      // The list holds only this download.
      resumeList.ids().forEach(resumeList::remove)
      live
    }
    live?.let(::stopped)
  }

  /**
   * Once per process (our jobs anchor's install): what an install left
   * goes ([cleanAfterInstall]), then a download the last process left
   * running, or one a network that stayed down stopped, carries on.
   */
  fun recoverOnce() {
    if (!recovered.compareAndSet(false, true)) return
    cleanAfterInstall()
    resumeInterrupted()
  }

  /**
   * The record and the whole updates folder go once the build installed
   * now is the recorded one or newer, or when there is no record
   * (CleanRules). Also PackageReplacedReceiver's. A download running in
   * this process is newer than any install: it stays. Never throws.
   */
  fun cleanAfterInstall() {
    try {
      synchronized(lock) {
        if (job != null) return
        val installed = InstalledVersion.of(app) ?: return
        val record = store.load()
        if (!CleanRules.afterInstall(installed, record)) return
        if (record != null) drop(record) else wipe { false }
      }
    } catch (_: Exception) {
      // Left for the next start; it never blocks anything.
    }
  }

  // The recorded download, when it is on the resume list and not done,
  // runs again; the list keeps nothing else.
  private fun resumeInterrupted() {
    try {
      synchronized(lock) {
        if (job != null) return
        val record = store.load()
        val name = record?.spec?.name
        val ids = resumeList.ids()
        ids.filter { it != name || record?.step == UpdateStep.DONE }.forEach(resumeList::remove)
        if (record == null || record.step == UpdateStep.DONE || record.spec.name !in ids) return
        store.save(UpdateRecord(record.spec, UpdateStep.DOWNLOAD))
        begin(record.spec)
      }
    } catch (_: Exception) {
      // The record or the disk would not read: nothing resumes by itself.
    }
  }

  // Under [lock]: the job is registered, on the resume list, and runs.
  private fun begin(spec: UpdateSpec): UpdateJob {
    paths.dir.mkdirs()
    val started = UpdateJob(spec, paths.part(spec.name).lengthOrZero(), ::send)
    job = started
    resumeList.add(spec.name)
    executor.execute { runJob(started) }
    return started
  }

  private fun runJob(job: UpdateJob) {
    val spec = job.spec
    val apk = paths.apk(spec.name)
    var error: Throwable? = null
    try {
      job.reporter.start()
      val expected = ExpectedFile(spec.name, spec.size, spec.sha256)
      val opener = RangeOpener.of(http, spec.url, emptyMap(), spec.name)
      retries.run(job.reporter, job.cancel) {
        FileDownloader(checkpoints).download(expected, opener, paths.part(spec.name), apk, 0, spec.size, job.reporter, job.cancel)
      }
    } catch (e: Throwable) {
      error = e
    }
    val final = if (error == null) {
      UpdateState(spec, UpdateStep.DONE, spec.size, apk.absolutePath)
    } else {
      UpdateState(spec, UpdateStep.FAILED, job.reporter.current.written, null, UpdateErrors.lineOf(error), UpdateErrors.codeOf(error))
    }
    synchronized(lock) {
      try {
        if (job.isDiscarded) {
          // Stopped, or another spec began: what it wrote after the stop's wipe goes too.
          paths.part(spec.name).delete()
          apk.delete()
        } else {
          store.save(UpdateRecord(spec, final.step, final.error, final.errorCode))
          // It stays on the list only for what a later start can fix: a network that stayed down.
          if (error == null || !RetryPolicy.retryable(error)) resumeList.remove(spec.name)
        }
      } catch (_: Exception) {
        // The record would not write: the event below still says how it ended.
      } finally {
        if (this.job === job) this.job = null
      }
    }
    job.reporter.end(final)
    job.markEnded()
    tell()
  }

  // Under [lock]: the record, its files and its resume entry go; the folder holds nothing else of ours.
  private fun drop(record: UpdateRecord) {
    wipe { false }
    store.delete()
    resumeList.remove(record.spec.name)
  }

  // Under [lock]: every entry of the updates folder but those [keep] names.
  private fun wipe(keep: (String) -> Boolean) {
    paths.dir.listFiles()?.forEach { if (!keep(it.name)) it.deleteRecursively() }
  }

  private fun stopped(job: UpdateJob) {
    UpdateEvents.send(job.reporter.current.copy(step = UpdateStep.STOPPED, path = null, error = null, errorCode = null))
    tell()
  }

  private fun send(state: UpdateState) {
    UpdateEvents.send(state)
    tell()
  }

  private fun tell() {
    for (l in listeners) {
      try {
        l.onUpdate()
      } catch (_: Exception) {
        // A listener's failure is its own; the download goes on.
      }
    }
  }

  private fun liveJob(): UpdateJob? = synchronized(lock) { job?.takeUnless { it.isDiscarded } }

  private fun File.lengthOrZero(): Long = if (isFile) length() else 0L

  companion object {
    // Past a connect and a wait for the answer's headers (UrlConnectionPort: 15 s + 30 s), which
    // a cancel cannot cut short; a read on the body it cuts at once.
    private const val STOP_WAIT_MS = 50_000L

    @Volatile
    private var instance: UpdateDownloads? = null

    fun get(context: Context): UpdateDownloads =
      instance ?: synchronized(this) { instance ?: UpdateDownloads(context).also { instance = it } }

    /** [cleanAfterInstall] from outside (PackageReplacedReceiver). Never throws. */
    fun cleanAfterInstall(context: Context) {
      try {
        get(context).cleanAfterInstall()
      } catch (_: Exception) {
        // Left for the next start.
      }
    }
  }
}
