package com.phonecando.runner.engine.work

// What agents ask for themselves (agents_keep_running, bridge/KeepRoutes):
// to stay up while idle in the background, to stay reachable (another
// agent's answer, a build off the phone), each with a reason the user sees
// and an end. The work watch keeps an agent with a live ask as it keeps one
// the user keeps running (KeepRunning), and the notification gives the
// reason, with Stop; the memory guard may still stop it. Unlike the user's
// switch an ask is never saved: it ends at its time, when the agent takes
// it back, or with its engine (WorkWatches). One per process (shared);
// thread-safe.
class KeepAsks(private val clock: () -> Long = System::currentTimeMillis) {
  /** [reason] on one line; [until] epoch ms. */
  data class Ask(val reason: String, val until: Long)

  private val asks = HashMap<String, Ask>()

  /** [agentId] stays up for [minutes] from now, in place of its last ask. */
  @Synchronized
  fun ask(agentId: String, reason: String, minutes: Int): Ask =
    Ask(tidy(reason), clock() + minutes * 60_000L).also { asks[agentId] = it }

  @Synchronized
  fun clear(agentId: String) {
    asks.remove(agentId)
  }

  /** [agentId]'s live ask; null when it has none or its time is up. */
  @Synchronized
  fun get(agentId: String): Ask? {
    val ask = asks[agentId] ?: return null
    if (clock() < ask.until) return ask
    asks.remove(agentId)
    return null
  }

  companion object {
    val shared = KeepAsks()

    /** One line, at most WorkRules.ASK_REASON_MAX characters. */
    fun tidy(reason: String): String {
      val line = reason.trim().replace(Regex("\\s+"), " ")
      val max = WorkRules.ASK_REASON_MAX
      return if (line.length <= max) line else line.take(max - 1).trimEnd() + "…"
    }
  }
}
