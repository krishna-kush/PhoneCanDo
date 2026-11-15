package com.phonecando.runner.schedule

// How an ACP turn a scheduled task started ended, for its run: an error
// answer, a refusal or a limit hit fails the run with why; the end of the
// turn (end_turn) or a stop you asked for (cancelled) leaves the run as it
// was. Pure.
object AcpTurnEnds {
  /** Why the run failed; null when the turn ended well or was stopped. */
  fun failure(stopReason: String?, error: String?): String? = when {
    error != null -> "the agent's turn ended with an error: " + error.trim().take(DETAIL_MAX).ifEmpty { "no detail" }
    stopReason == REFUSAL -> "the agent refused the task"
    stopReason == MAX_TOKENS -> "the agent's turn hit its token limit"
    stopReason == MAX_TURN_REQUESTS -> "the agent's turn hit its limit of model requests"
    else -> null
  }

  const val REFUSAL = "refusal"
  const val MAX_TOKENS = "max_tokens"
  const val MAX_TURN_REQUESTS = "max_turn_requests"

  private const val DETAIL_MAX = 200
}
