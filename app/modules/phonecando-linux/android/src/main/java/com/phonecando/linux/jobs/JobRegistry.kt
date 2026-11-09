package com.phonecando.linux.jobs

import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.lre.api.CancelSignal
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** What a job works on: LinuxProgress.target in the JS types. */
data class JobTarget(val kind: Kind, val id: String) {
  enum class Kind(val id: String) { ENV("env"), IMAGE("image") }

  companion object {
    fun env(id: String) = JobTarget(Kind.ENV, id)

    fun image(id: String) = JobTarget(Kind.IMAGE, id)
  }
}

/**
 * One running job: its id for JS, its target, and the cancel flag lre polls.
 * [guestScript]: a script running in a ready image (runGuestScript), which
 * leaves the image usable meanwhile, unlike a create or reset.
 */
class Job(val id: String, val target: JobTarget, val guestScript: Boolean = false) {
  private val cancelled = AtomicBoolean(false)
  private val done = CountDownLatch(1)

  val cancel: CancelSignal = CancelSignal { cancelled.get() }

  val isCancelled: Boolean get() = cancelled.get()

  fun requestCancel() = cancelled.set(true)

  /** Waits up to [millis] for the job to end; true when it did. */
  fun await(millis: Long): Boolean = done.await(millis, TimeUnit.MILLISECONDS)

  internal fun markDone() = done.countDown()
}

/**
 * The jobs running in this process, at most one per target. Lives as long
 * as the process (a JS reload keeps jobs running), so a record that says
 * `creating` with no job here was cut short by a process death. Pure.
 */
class JobRegistry {
  private val lock = Any()
  private val byTarget = HashMap<JobTarget, Job>()
  private var counter = 0L

  /** Registers a new job for [target]. @throws LinuxError busy when one already runs for it. */
  fun begin(target: JobTarget, guestScript: Boolean = false): Job = synchronized(lock) {
    if (byTarget.containsKey(target)) {
      throw LinuxError(LinuxErrorCode.BUSY, "a job already runs for ${target.kind.id} ${target.id}")
    }
    counter++
    Job("job-$counter", target, guestScript).also { byTarget[target] = it }
  }

  /** Unregisters [job] (the target is free again) and wakes whoever awaits it. */
  fun end(job: Job) {
    synchronized(lock) {
      if (byTarget[job.target] === job) byTarget.remove(job.target)
    }
    job.markDone()
  }

  fun live(target: JobTarget): Job? = synchronized(lock) { byTarget[target] }

  fun isLive(target: JobTarget): Boolean = live(target) != null

  /** Asks job [jobId] to stop; false when no such job runs. The job ends at its next cancel check. */
  fun cancel(jobId: String): Boolean {
    val job = synchronized(lock) { byTarget.values.firstOrNull { it.id == jobId } } ?: return false
    job.requestCancel()
    return true
  }

  /**
   * Cancels whatever runs for [target] and waits up to [millis] for it to
   * end. @throws LinuxError busy when it is still running then.
   */
  fun cancelAndAwait(target: JobTarget, millis: Long) {
    val job = live(target) ?: return
    job.requestCancel()
    if (!job.await(millis)) {
      throw LinuxError(LinuxErrorCode.BUSY, "the job for ${target.kind.id} ${target.id} did not stop in time")
    }
  }
}
