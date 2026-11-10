package com.phonecando.models.jobs

import com.phonecando.lme.api.Progress
import com.phonecando.lme.api.ProgressSink

/** A download's wait before it tries again: try [attempt] of [max], in [delayMillis]. */
data class RetryWait(val attempt: Int, val max: Int, val delayMillis: Long)

/**
 * A job's progress sink: lme's reports become `phonecandoModelsProgress`
 * events (ModelProgress in the JS types), a few per second (a new step or a
 * retry passes at once), each with the transfer's rate; [finish] sends the
 * last one whatever the throttle says. Only `download` and `import` bytes
 * count for the rate: re-hashing a resumed `.part` (`verify`) is not
 * traffic. Synchronized: a retry is announced from the job's thread between
 * lme's reports. Pure apart from the clock.
 */
class JobReporter(
  private val job: ModelJob,
  private val emit: (Map<String, Any?>) -> Unit,
  private val onProgress: (ModelJob) -> Unit = {},
  private val intervalMillis: Long = 250,
  private val now: () -> Long = System::currentTimeMillis,
) : ProgressSink {
  private val meter = RateMeter(now = now)
  private var last = Progress(START, 0, null)
  private var rate: Long? = null
  private var retry: RetryWait? = null
  private var lastKey: String? = null
  private var lastAt = Long.MIN_VALUE

  /** The most bytes any report said were done: a retry that brought more starts its count over. */
  @get:Synchronized
  var mostDone: Long = 0
    private set

  @Synchronized
  override fun report(progress: Progress) {
    if (progress.step != last.step) meter.reset()
    last = progress
    retry = null
    rate = if (progress.step in TRANSFER_STEPS) meter.add(progress.done) else null
    if (progress.step in TRANSFER_STEPS) mostDone = maxOf(mostDone, progress.done)
    job.done = progress.done
    job.total = progress.total
    onProgress(job)
    val key = progress.step
    val t = now()
    if (key == lastKey && t - lastAt < intervalMillis) return
    lastKey = key
    lastAt = t
    emit(event(null, null, false))
  }

  /** The job waits [wait] before it tries again: one event at once. */
  @Synchronized
  fun retrying(wait: RetryWait) {
    retry = wait
    rate = null
    meter.reset()
    lastKey = "$RETRY/${wait.attempt}"
    lastAt = now()
    emit(event(null, null, false))
  }

  fun start() = report(Progress(START, 0, null))

  /** The last event; [error] and [errorCode] set when the job failed. */
  @Synchronized
  fun finish(error: String?, errorCode: String?) {
    retry = null
    emit(event(error, errorCode, true))
  }

  private fun event(error: String?, errorCode: String?, finished: Boolean): Map<String, Any?> = buildMap {
    put("jobId", job.id)
    put("target", mapOf("kind" to job.target.kind.wire, "id" to job.target.id))
    put("label", job.label)
    put("step", if (retry != null) RETRY else last.step)
    put("done", last.done.toDouble())
    put("total", last.total?.toDouble())
    put("rateBytesPerSec", rate?.toDouble())
    put(
      "retry",
      retry?.let { mapOf("attempt" to it.attempt, "max" to it.max, "delaySec" to (it.delayMillis / 1000).toInt()) },
    )
    put("finished", finished)
    if (finished) put("ok", error == null)
    put("error", error)
    put("errorCode", errorCode)
  }

  companion object {
    const val START = "start"
    const val RETRY = "retry"
    private val TRANSFER_STEPS = setOf("download", "import")
  }
}
