package com.phonecando.runner.presence

// When an agent's phone_notify posts. Not while its own chat is on screen
// (it says it in the chat instead: posted false, with why). Otherwise at
// most PER_MINUTE in a minute and PER_HOUR in an hour per agent; past that
// 429 notify_too_often with when it may post again. Each post alerts. Only
// posts count. The windows live in memory. Pure: the clock is injected.
class NotifyRules(private val clock: () -> Long) {
  sealed interface Verdict {
    data object Post : Verdict

    /** Not posted, not an error: [reason] says why. */
    data class Skip(val reason: String) : Verdict

    /** Over a limit: try again in [retryAfterMs]. */
    data class TooOften(val retryAfterMs: Long) : Verdict
  }

  private val posts = HashMap<String, ArrayDeque<Long>>()

  /** Whether [agentId] may post now; [chatOnScreen]: PhoneCanDo shows its chat. */
  @Synchronized
  fun check(agentId: String, chatOnScreen: Boolean): Verdict {
    if (chatOnScreen) return Verdict.Skip(ON_SCREEN)
    val now = clock()
    val times = posts[agentId] ?: return Verdict.Post
    while (times.isNotEmpty() && now - times.first() >= HOUR_MS) times.removeFirst()
    // The post that would leave the window last: the PER_*-th newest.
    val wait = maxOf(waitFor(times, PER_MINUTE, MINUTE_MS, now), waitFor(times, PER_HOUR, HOUR_MS, now))
    return if (wait > 0) Verdict.TooOften(wait) else Verdict.Post
  }

  private fun waitFor(times: ArrayDeque<Long>, max: Int, spanMs: Long, now: Long): Long {
    if (times.size < max) return 0
    return (spanMs - (now - times[times.size - max])).coerceAtLeast(0)
  }

  /** [agentId] posted now. */
  @Synchronized
  fun posted(agentId: String) {
    posts.getOrPut(agentId) { ArrayDeque() }.addLast(clock())
  }

  /** A deleted agent's windows go. */
  @Synchronized
  fun forget(agentId: String) {
    posts.remove(agentId)
  }

  companion object {
    const val PER_MINUTE = 1
    const val PER_HOUR = 5
    const val MINUTE_MS = 60_000L
    const val HOUR_MS = 60 * 60_000L
    const val ON_SCREEN = "your chat is on screen; say it in the chat instead"

    /** PhoneCanDo is in front with [agentId]'s chat on screen ([openAgent]: whose chat or TUI it shows). */
    fun chatOnScreen(appShown: Boolean, openAgent: String?, agentId: String): Boolean = appShown && openAgent == agentId
  }
}
