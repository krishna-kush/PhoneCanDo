package com.phonecando.runner.controllock

// Ask mode's unlocks, one per agent: the user's yes to that agent's
// mobile_request_unlock. One lasts until the agent hands the phone back
// (mobile_return), its engine stops, or it goes `idleMs` without a
// phone-control call; then its next task asks again. Pure: the clock is
// injected.
class AskGrants(private val idleMs: Long, private val clock: () -> Long) {
  // Agent id → when it last used phone control (or was granted it).
  private val lastUse = HashMap<String, Long>()

  @Synchronized
  fun grant(agentId: String) {
    lastUse[agentId] = clock()
  }

  /** Whether [agentId] holds an unlock; `use` restarts its idle time. */
  @Synchronized
  fun allows(agentId: String, use: Boolean = false): Boolean {
    val last = lastUse[agentId] ?: return false
    val now = clock()
    if (now - last >= idleMs) {
      lastUse.remove(agentId)
      return false
    }
    if (use) lastUse[agentId] = now
    return true
  }

  @Synchronized
  fun end(agentId: String) {
    lastUse.remove(agentId)
  }

  @Synchronized
  fun clear() {
    lastUse.clear()
  }

  /** How many agents hold an unlock now. */
  @Synchronized
  fun count(): Int {
    val now = clock()
    lastUse.values.removeAll { now - it >= idleMs }
    return lastUse.size
  }
}
