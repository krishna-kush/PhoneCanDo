package com.phonecando.linux.jobs

import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import com.phonecando.network.retry.RetrySink
import com.phonecando.network.retry.RetryWait

/**
 * A job's progress sink: every report goes through the throttle to
 * [emit]; [finish] sends the last event (with the error of a failed job)
 * whatever the throttle says. A download's tries (RetryLoop) also tell it
 * when they wait: to try again (step `retry`) or for a network (`offline`),
 * one event at once each. Synchronized: a guest script reports from its
 * output thread and its once-a-second pulse, and an event must never
 * overtake a newer one. Pure.
 */
class JobReporter(
  private val job: Job,
  private val emit: (ProgressEvent) -> Unit,
  private val throttle: ProgressThrottle = ProgressThrottle(),
) : ProgressSink, RetrySink {
  private var last = Progress(START, 0, null)

  private var script: ScriptDetail? = null

  // Set while a download waits before its next try, or for a network; the next report clears them.
  private var wait: RetryWait? = null
  private var offline = false

  /** The most bytes a `download` report said were done: a try that brought more starts the retry count over. */
  @get:Synchronized
  override var mostDone: Long = 0
    private set

  @Synchronized
  override fun report(progress: Progress) {
    last = progress
    wait = null
    offline = false
    if (progress.step == DOWNLOAD) mostDone = maxOf(mostDone, progress.done)
    // A new phase or a new retry passes at once, like a new step.
    val key = script?.let { s -> "${progress.step}/${s.phase}/${s.retry?.attempt}" } ?: progress.step
    if (throttle.pass(key)) emit(event(null, null, false))
  }

  /** A guest script's state: kept for every later event, the last one included. */
  @Synchronized
  fun reportScript(detail: ScriptDetail, progress: Progress) {
    script = detail
    report(progress)
  }

  @Synchronized
  override fun retrying(wait: RetryWait) {
    this.wait = wait
    offline = false
    throttle.pass("$RETRY/${wait.attempt}")
    emit(event(null, null, false))
  }

  @Synchronized
  override fun waitingForNetwork() {
    wait = null
    offline = true
    throttle.pass(OFFLINE)
    emit(event(null, null, false))
  }

  fun start() = report(Progress(START, 0, null))

  /** The last event; [error] and [errorCode] set when the job failed. */
  @Synchronized
  fun finish(error: String?, errorCode: String?) {
    wait = null
    offline = false
    emit(event(error, errorCode, true))
  }

  private fun event(error: String?, errorCode: String?, finished: Boolean): ProgressEvent {
    val step = if (offline) OFFLINE else if (wait != null) RETRY else last.step
    return ProgressEvent(job.id, job.target, step, last.done, last.total, error, errorCode, finished, script, wait)
  }

  companion object {
    const val START = "start"
    const val RETRY = "retry"
    const val OFFLINE = "offline"

    // lre's blob bytes: the only step whose growth counts as a try getting somewhere.
    private const val DOWNLOAD = "download"
  }
}
