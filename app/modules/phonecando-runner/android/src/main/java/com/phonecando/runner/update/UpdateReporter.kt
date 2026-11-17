package com.phonecando.runner.update

import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import com.phonecando.network.retry.RetrySink
import com.phonecando.network.retry.RetryWait

/**
 * One update download's progress sink: network's reports and the retry
 * loop's waits become [UpdateState]s for [emit]. A new step (verify,
 * download, retry, offline) goes at once; bytes of the same step at most
 * every [intervalMillis] (about 4 a second); [end] always. Only `download`
 * bytes count as progress for the retry loop: re-hashing a partial is not
 * traffic. Synchronized: a retry is announced from the job's thread between
 * network's reports. Pure apart from the clock.
 */
class UpdateReporter(
  spec: UpdateSpec,
  written: Long,
  private val emit: (UpdateState) -> Unit,
  private val intervalMillis: Long = 250,
  private val now: () -> Long = System::currentTimeMillis,
) : ProgressSink, RetrySink {
  private var state = UpdateState(spec, UpdateStep.DOWNLOAD, written)
  private var lastAt: Long? = null

  /** The state as of the last report, sent or not. */
  @get:Synchronized
  val current: UpdateState get() = state

  @get:Synchronized
  override var mostDone: Long = 0
    private set

  /** The first event: it starts with the bytes an earlier try left. */
  @Synchronized
  fun start() = send()

  @Synchronized
  override fun report(progress: Progress) {
    val step = UpdateStep.ofProgress(progress.step)
    if (step == UpdateStep.DOWNLOAD) mostDone = maxOf(mostDone, progress.done)
    val same = step == state.step
    state = state.copy(step = step, written = progress.done)
    val last = lastAt
    if (same && last != null && now() - last < intervalMillis) return
    send()
  }

  /** The job waits before it tries again. */
  @Synchronized
  override fun retrying(wait: RetryWait) {
    state = state.copy(step = UpdateStep.RETRY)
    send()
  }

  /** The job waits for a network before it tries again. */
  @Synchronized
  override fun waitingForNetwork() {
    state = state.copy(step = UpdateStep.OFFLINE)
    send()
  }

  /** How it ended (done, failed, stopped): sent whatever the throttle says. */
  @Synchronized
  fun end(final: UpdateState) {
    state = final
    send()
  }

  private fun send() {
    lastAt = now()
    emit(state)
  }
}
