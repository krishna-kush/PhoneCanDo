package com.phonecando.linux.jobs

import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink

/** One `phonecandoLinuxProgress` event: LinuxProgress in the JS types. */
data class ProgressEvent(
  val jobId: String,
  val target: JobTarget,
  val step: String,
  val done: Long,
  val total: Long?,
  val error: String?,
  /** LinuxErrorCode of a failed job's last event, else null. */
  val errorCode: String?,
  val finished: Boolean,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "jobId" to jobId,
    "target" to mapOf("kind" to target.kind.id, "id" to target.id),
    "step" to step,
    "done" to done,
    "total" to total,
    "error" to error,
    "errorCode" to errorCode,
    "finished" to finished,
  )
}

/**
 * A job's progress sink: every report goes through the throttle to
 * [emit]; [finish] sends the last event (with the error of a failed job)
 * whatever the throttle says. Pure.
 */
class JobReporter(
  private val job: Job,
  private val emit: (ProgressEvent) -> Unit,
  private val throttle: ProgressThrottle = ProgressThrottle(),
) : ProgressSink {
  @Volatile
  private var last = Progress(START, 0, null)

  override fun report(progress: Progress) {
    last = progress
    if (throttle.pass(progress.step)) emit(event(progress, null, null, false))
  }

  fun start() = report(Progress(START, 0, null))

  /** The last event; [error] and [errorCode] set when the job failed. */
  fun finish(error: String?, errorCode: String?) = emit(event(last, error, errorCode, true))

  private fun event(p: Progress, error: String?, errorCode: String?, finished: Boolean) =
    ProgressEvent(job.id, job.target, p.step, p.done, p.total, error, errorCode, finished)

  companion object {
    const val START = "start"
  }
}
