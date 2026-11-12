package com.phonecando.linux.jobs

import com.phonecando.network.retry.RetryWait

/** A guest script's `@retry <phase> <n>/<max>` line: a step failed and runs again, try [attempt] of [max]. */
data class ScriptRetry(val attempt: Int, val max: Int)

/** How long a guest script has run and what the app received meanwhile, for a UI that must look alive. */
data class ScriptActivity(
  /** Whole seconds since the script started. */
  val elapsedSec: Long,
  /** Bytes the app received since the script started (the whole app's count); null when Android cannot count them. */
  val downloadedBytes: Long?,
  /** That count's rate over the last few seconds; null when Android cannot count. */
  val rateBytesPerSec: Long?,
  /** The phone has a network that offers the internet, as of the last reading; null when Android won't say. */
  val online: Boolean? = null,
)

/** What a guest script job adds to its events (runGuestScript). */
data class ScriptDetail(
  /** The name of the script's last `@phase <name>` line; null before the first. */
  val phase: String?,
  /** The last lines it printed, redacted. */
  val tail: List<String>,
  /** Its exit code once it ended by itself; null while it runs or when it was stopped. */
  val exitCode: Int?,
  /** Its last `@retry` line within the phase now; null when none came since the phase began. */
  val retry: ScriptRetry? = null,
  /** Time and bytes so far; null before the first reading. */
  val activity: ScriptActivity? = null,
)

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
  /** Set on every event of a guest script job, null on other jobs. */
  val script: ScriptDetail? = null,
  /** A download's wait before its next try (step `retry`); null otherwise. */
  val wait: RetryWait? = null,
) {
  /** `ok` only on the last event; `retry` only while a download waits; the script fields only on a guest script job's. */
  fun toMap(): Map<String, Any?> = buildMap {
    put("jobId", jobId)
    put("target", mapOf("kind" to target.kind.id, "id" to target.id))
    put("step", step)
    put("done", done)
    put("total", total)
    put("error", error)
    put("errorCode", errorCode)
    put("finished", finished)
    if (finished) put("ok", error == null)
    wait?.let {
      put("retry", mapOf("attempt" to it.attempt, "max" to it.max, "delaySec" to (it.delayMillis / 1000).toInt(), "reason" to reasonOf(it)))
    }
    script?.let {
      put("phase", it.phase)
      put("tail", it.tail)
      put("exitCode", it.exitCode)
      put("retry", it.retry?.let { r -> mapOf("attempt" to r.attempt, "max" to r.max) })
      put("elapsedSec", it.activity?.elapsedSec ?: 0L)
      put("downloadedBytes", it.activity?.downloadedBytes)
      put("rateBytesPerSec", it.activity?.rateBytesPerSec)
      put("online", it.activity?.online)
    }
  }

  private fun reasonOf(wait: RetryWait): String = when (wait.reason) {
    RetryWait.Reason.NETWORK -> "network"
    RetryWait.Reason.RATE_LIMITED -> "rate_limited"
  }
}
