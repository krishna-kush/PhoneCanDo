package com.phonecando.linux

import android.content.Context
import com.phonecando.linux.catalog.CatalogOps
import com.phonecando.linux.defaultimage.DefaultImageAsset
import com.phonecando.linux.envs.EnvOps
import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.linux.host.AndroidHost
import com.phonecando.linux.host.LinuxPaths
import com.phonecando.linux.images.ImageBases
import com.phonecando.linux.images.ImageLocks
import com.phonecando.linux.images.ImageOps
import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobRegistry
import com.phonecando.linux.jobs.JobReporter
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.linux.jobs.Recovery
import com.phonecando.linux.jobs.transactWithJob
import com.phonecando.linux.records.LinuxRecords
import com.phonecando.lre.image.delete.ImageDelete
import com.phonecando.lre.oci.catalog.HubCatalog
import com.phonecando.lre.oci.http.UrlConnectionTransport
import com.phonecando.lre.oci.registry.RegistryClient
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The Linux runtime's Android host, one per process: the records, the
 * running jobs and our own executor (Expo's async queue is one thread
 * shared by every module; a download or unpack takes minutes). It outlives
 * a JS reload, so jobs keep running and a new module instance sees them.
 * Events go to whichever module instances listen.
 */
class LinuxHost private constructor(context: Context) {
  interface Listener {
    /** A `phonecandoLinuxProgress` event (ProgressEvent.toMap). */
    fun onProgress(event: Map<String, Any?>)

    /** Any env or image record changed. */
    fun onChanged()
  }

  private val listeners = CopyOnWriteArrayList<Listener>()
  private val recovered = AtomicBoolean(false)

  val android = AndroidHost(context)
  val paths = LinuxPaths(android.filesDir)
  val jobs = JobRegistry()
  val imageLocks = ImageLocks()
  val records = LinuxRecords(paths.state) { listeners.forEach { it.onChanged() } }
  val executor: ExecutorService = Executors.newCachedThreadPool { task ->
    Thread(task, "phonecando-linux").apply { isDaemon = true }
  }

  private val transport = UrlConnectionTransport()
  val registry = RegistryClient(transport)
  val defaultImage = DefaultImageAsset(context.assets)
  val bases = ImageBases(paths, defaultImage, registry)

  val envs = EnvOps(this)
  val images = ImageOps(this)
  val catalog = CatalogOps(this, HubCatalog(transport))

  fun addListener(listener: Listener) = listeners.add(listener)

  fun removeListener(listener: Listener) = listeners.remove(listener)

  /** A record transaction that registers a job (see [transactWithJob]). */
  fun <T> transactWithJob(block: LinuxRecords.Transaction.(begin: (JobTarget) -> Job) -> T): T =
    records.transactWithJob(jobs, block)

  /**
   * Runs [job] (already registered with [jobs]) on our executor. On a
   * failure [onError] records it; then the job ends (its target is free
   * again) and the last progress event goes out, in that order, so a
   * listener that reacts to it sees the final records and can start the
   * next job.
   */
  fun run(job: Job, onError: (Throwable) -> Unit, body: (JobReporter) -> Unit) {
    val reporter = JobReporter(job, { event -> listeners.forEach { it.onProgress(event.toMap()) } })
    executor.execute {
      var error: Throwable? = null
      try {
        reporter.start()
        body(reporter)
      } catch (e: Throwable) {
        error = e
        try {
          onError(e)
        } catch (_: Throwable) {
          // Recording the failure failed (disk); the event below still says it.
        }
      } finally {
        jobs.end(job)
        reporter.finish(error?.let(LinuxErrorCode::lineOf), error?.let { LinuxErrorCode.of(it).code })
      }
    }
  }

  /**
   * Once per process, on the first module create: records a process death
   * left mid-job get fixed (Recovery), a delete it cut short is finished,
   * and the trash from earlier deletes is emptied in the background. A JS
   * reload creates the module again but keeps the process and its jobs, so
   * there is nothing to recover then (an image mid-delete has no job).
   */
  fun recoverOnce() {
    if (!recovered.compareAndSet(false, true)) return
    val plan = try {
      records.transact {
        val plan = Recovery.plan(envs, images, jobs::isLive)
        plan.envs.forEach(::putEnv)
        plan.images.forEach(::putImage)
        plan
      }
    } catch (_: Exception) {
      // The records stay as they were (disk); every call still works on them.
      null
    }
    plan?.finishDeletes?.forEach { id ->
      try {
        ImageDelete().delete(paths.image(id), executor)
        records.transact { removeImage(id) }
      } catch (_: Exception) {
        // Stays `deleting`; the next start tries again.
      }
    }
    executor.execute {
      val delete = ImageDelete()
      delete.emptyTrash(paths.imagesTrash)
      delete.emptyTrash(paths.envsTrash)
    }
  }

  companion object {
    @Volatile
    private var instance: LinuxHost? = null

    fun get(context: Context): LinuxHost =
      instance ?: synchronized(this) { instance ?: LinuxHost(context.applicationContext).also { instance = it } }
  }
}
