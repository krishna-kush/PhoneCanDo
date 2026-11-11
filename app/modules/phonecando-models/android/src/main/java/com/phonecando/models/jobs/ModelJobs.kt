package com.phonecando.models.jobs

import com.phonecando.models.errors.ModelError
import com.phonecando.models.errors.ModelErrorCode
import com.phonecando.network.CancelSignal
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** What a job works on: ModelProgress.target in the JS types. A download's id is its id in models.json. */
data class JobTarget(val kind: Kind, val id: String) {
  enum class Kind(val wire: String) { DOWNLOAD("download"), IMPORT("import") }
}

/**
 * One running job: its id for JS, its target, a [label] for people (the
 * model's name, the picked file's) and the cancel flag lme polls. [done] and
 * [total] are its last progress, for the runner's service notification.
 */
class ModelJob(val id: String, val target: JobTarget, val label: String) {
  private val cancelled = AtomicBoolean(false)
  private val ended = CountDownLatch(1)

  @Volatile var done: Long = 0

  @Volatile var total: Long? = null

  val cancel: CancelSignal = CancelSignal { cancelled.get() }

  val isCancelled: Boolean get() = cancelled.get()

  fun requestCancel() = cancelled.set(true)

  /** Waits up to [millis] for the job to end; true when it did. */
  fun await(millis: Long): Boolean = ended.await(millis, TimeUnit.MILLISECONDS)

  internal fun markEnded() = ended.countDown()
}

/**
 * The model jobs running in this process, at most one per target. Lives as
 * long as the process (a JS reload keeps them running). Listeners hear when
 * a job begins or ends, and about its progress at most every [tickMillis]
 * (the runner keeps its foreground service up and its notification current
 * from these). Pure apart from the clock.
 */
class ModelJobs(private val tickMillis: Long = 2_000, private val now: () -> Long = System::currentTimeMillis) {
  fun interface Listener {
    fun onJobs()
  }

  private val lock = Any()
  private val byTarget = LinkedHashMap<JobTarget, ModelJob>()
  private val lastTick = HashMap<String, Long>()
  private val listeners = CopyOnWriteArrayList<Listener>()
  private var counter = 0L

  fun addListener(listener: Listener) = listeners.addIfAbsent(listener)

  fun removeListener(listener: Listener) = listeners.remove(listener)

  /** Registers a new job for [target]. @throws ModelError busy when one already runs for it. */
  fun begin(target: JobTarget, label: String): ModelJob {
    val job = synchronized(lock) {
      if (byTarget.containsKey(target)) throw ModelError(ModelErrorCode.BUSY, "a job already runs for ${target.kind.wire} ${target.id}")
      counter++
      ModelJob("model-job-$counter", target, label).also { byTarget[target] = it }
    }
    tellListeners()
    return job
  }

  /** Unregisters [job] (its target is free again) and wakes whoever awaits it. */
  fun end(job: ModelJob) {
    synchronized(lock) {
      if (byTarget[job.target] === job) byTarget.remove(job.target)
      lastTick.remove(job.id)
    }
    job.markEnded()
    tellListeners()
  }

  /** [job] made progress: listeners hear about it at most every tickMillis. */
  fun progressed(job: ModelJob) {
    val tell = synchronized(lock) {
      val t = now()
      val last = lastTick[job.id]
      if (last != null && t - last < tickMillis) return
      lastTick[job.id] = t
      true
    }
    if (tell) tellListeners()
  }

  fun live(target: JobTarget): ModelJob? = synchronized(lock) { byTarget[target] }

  fun running(): List<ModelJob> = synchronized(lock) { byTarget.values.toList() }

  fun anyRunning(): Boolean = synchronized(lock) { byTarget.isNotEmpty() }

  /** Asks job [jobId] to stop; false when no such job runs. It ends at its next cancel check. */
  fun cancel(jobId: String): Boolean {
    val job = synchronized(lock) { byTarget.values.firstOrNull { it.id == jobId } } ?: return false
    job.requestCancel()
    return true
  }

  /** Cancels what runs for [target] and waits up to [millis]. @throws ModelError busy when it still runs then. */
  fun cancelAndAwait(target: JobTarget, millis: Long) {
    val job = live(target) ?: return
    job.requestCancel()
    if (!job.await(millis)) throw ModelError(ModelErrorCode.BUSY, "the job for ${target.kind.wire} ${target.id} did not stop in time")
  }

  private fun tellListeners() {
    for (l in listeners) {
      try {
        l.onJobs()
      } catch (_: Exception) {
        // A listener's failure is its own; the job goes on.
      }
    }
  }
}
