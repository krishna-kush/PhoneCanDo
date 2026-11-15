package com.phonecando.runner.memory

// Which agent the memory guard stops next, and what that stop gives back.
// Never one at work while an idle one can go: agents with no run going
// first, of those the ones with no job left; then, among equals, a stop
// that frees what the phone is short of (its processes plus a model only
// it holds, whose server goes with it), the least recently used of those;
// else the one that frees the most. The agent on screen (the app in front)
// is spared, unless the one to go instead is at work. Pure.
object MemoryVictims {
  /**
   * An engine starting or ready. [working]: a run is going or it is
   * starting (its kind's idle rule says it is not idle); [busy]: it left a
   * job running (a dev server, a download) or the user keeps it running;
   * [frees]: the bytes its stop gives back (freed()), null when unread.
   */
  data class Candidate(
    val agentId: String,
    val working: Boolean,
    val lastUsedAt: Long?,
    val busy: Boolean = false,
    val frees: Long? = null,
  )

  /**
   * The agent to stop next; [keep]: the one on screen while the app is in
   * front; [shortBytes]: what the phone is short of (MemoryPolicy.short).
   * Null: none may be stopped.
   */
  fun victim(agents: List<Candidate>, keep: String?, shortBytes: Long = 0): String? {
    val pick = agents.filter { it.agentId != keep }.minWithOrNull(order(shortBytes))
    val shown = agents.firstOrNull { it.agentId == keep && !it.working }
    return if (pick != null && pick.working && shown != null) shown.agentId else pick?.agentId
  }

  /**
   * What stopping [agentId] gives back: its own processes' bytes plus each
   * model it alone holds ([models], their holders); null when the bytes
   * were not read.
   */
  fun freed(agentId: String, bytes: ProcessMemory.Owners?, models: List<MemoryModel>): Long? {
    if (bytes == null) return null
    val alone = models.filter { it.agentIds == listOf(agentId) }.sumOf { bytes.models[it.modelId] ?: 0L }
    return (bytes.agents[agentId] ?: 0L) + alone
  }

  private fun enough(c: Candidate, shortBytes: Long) = c.frees != null && c.frees >= shortBytes

  private fun order(shortBytes: Long) = compareBy<Candidate>(
    { it.working },
    { it.busy },
    { !enough(it, shortBytes) },
    // Of the stops that free too little, the biggest first.
    { if (enough(it, shortBytes)) 0L else -(it.frees ?: 0L) },
    { it.lastUsedAt ?: 0L },
    { it.agentId },
  )
}
