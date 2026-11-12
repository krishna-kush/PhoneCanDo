package com.phonecando.runner.messages

// The turns another agent's message started. A message wakes an agent
// (its hook or reader claimed a set that may wake it while it had no run
// going, or its server took the wake call): from then until that run ends
// the agent is startedByAgent, so the screen queue refuses it the screen
// (unless the queue handed it the screen), and what it sends carries the
// cause's hop + 1. The run ends when the agent leaves the working chats
// (the chat board, through working()) after being in them, or its engine
// stops; a wake that shows no run within WAKE_START_MS was none. Pure: the
// clock is injected.
class WakeTracker(private val clock: () -> Long) {
  private class Turn(val hop: Int, val since: Long, var running: Boolean)

  private val turns = HashMap<String, Turn>()

  /** A message with [hop] (the highest of the set) woke [agentId]; [workingNow]: its run already shows. */
  @Synchronized
  fun woke(agentId: String, hop: Int, workingNow: Boolean) {
    val current = turns[agentId]
    turns[agentId] = Turn(maxOf(hop, current?.hop ?: 0), clock(), workingNow || current?.running == true)
  }

  /** The agents with a run going now (the chat board); ends the woken runs that are over. */
  @Synchronized
  fun working(agentIds: Set<String>) {
    val now = clock()
    val each = turns.entries.iterator()
    while (each.hasNext()) {
      val (agentId, turn) = each.next()
      val on = agentId in agentIds
      when {
        on -> turn.running = true
        turn.running -> each.remove()
        now - turn.since > MessageRules.WAKE_START_MS -> each.remove()
      }
    }
  }

  /** Its run ended another way (its engine stopped, the agent is gone). */
  @Synchronized
  fun ended(agentId: String) {
    turns.remove(agentId)
  }

  /** [agentId]'s current run was started by another agent's message. */
  @Synchronized
  fun startedByAgent(agentId: String): Boolean {
    val turn = turns[agentId] ?: return false
    if (!turn.running && clock() - turn.since > MessageRules.WAKE_START_MS) {
      turns.remove(agentId)
      return false
    }
    return true
  }

  /** The hop of a message [agentId] sends now: its cause's + 1 in a woken run, else 0. */
  @Synchronized
  fun hopFor(agentId: String): Int = if (startedByAgent(agentId)) turns.getValue(agentId).hop + 1 else 0
}
