package com.phonecando.linux.jobs

import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink

/**
 * A job's progress sink: every report goes through the throttle to
 * [emit]; [finish] sends the last event (with the error of a failed job)
 * whatever the throttle says. Synchronized: a guest script reports from
 * its output thread and its once-a-second pulse, and an event must never
 * overtake a newer one. Pure.
 */
class JobReporter(
  private val job: Job,
  private val emit: (ProgressEvent) -> Unit,
  private val throttle: ProgressThrottle = ProgressThrottle(),
) : ProgressSink {
  private var last = Progress(START, 0, null)

  private var script: ScriptDetail? = null

  @Synchronized
  override fun report(progress: Progress) {
    last = progress
    // A new phase or a new retry passes at once, like a new step.
    val key = script?.let { s -> "${progress.step}/${s.phase}/${s.retry?.attempt}" } ?: progress.step
    if (throttle.pass(key)) emit(event(progress, null, null, false))
  }

  /** A guest script's state: kept for every later event, the last one included. */
  @Synchronized
  fun reportScript(detail: ScriptDetail, progress: Progress) {
    script = detail
    report(progress)
  }

  fun start() = report(Progress(START, 0, null))

  /** The last event; [error] and [errorCode] set when the job failed. */
  @Synchronized
  fun finish(error: String?, errorCode: String?) = emit(event(last, error, errorCode, true))

  private fun event(p: Progress, error: String?, errorCode: String?, finished: Boolean) =
    ProgressEvent(job.id, job.target, p.step, p.done, p.total, error, errorCode, finished, script)

  companion object {
    const val START = "start"
  }
}
