package com.phonecando.runner.notify

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.EngineEvent.Kind

// Which engine events become an agent alert (AgentAlerts posts them). Pure;
// per agent it keeps only its subagents' child sessions and the last alert.
// - A run's verdict (FINISHED, FAILED) alerts for a top-level session only:
//   a child session (session.created with a parent) ends inside its
//   parent's run, which has its own verdict.
// - WAITING (a permission or form blocks the run on the user) alerts for
//   any session, since a child's question holds up its parent too.
// - The same alert for the same session is not repeated until that session
//   moves again (WORKING), so a verdict seen twice alerts once.
// - An event without a session never alerts; neither does an interrupted
//   run (the user stopped it; the kind maps it to OTHER).
// - Nothing alerts while PhoneCanDo is in front: `inFront` is asked only
//   when an alert is due, and the alert still counts as given, so the same
//   one does not come later.
class AlertRules(private val maxChildren: Int = MAX_CHILDREN) {
  enum class Alert(val text: String) {
    FINISHED("Finished. Tap to see the result."),
    FAILED("Stopped with an error. Tap to see what happened."),
    WAITING("Waiting for your answer."),
  }

  private class AgentState {
    // Oldest first, so the oldest is dropped past the cap.
    val children = LinkedHashSet<String>()
    var last: Pair<Alert, String>? = null
  }

  private val agents = HashMap<String, AgentState>()

  /** The alert this event calls for, or null. */
  fun onEvent(agentId: String, event: EngineEvent, inFront: () -> Boolean): Alert? =
    due(agentId, event)?.takeUnless { inFront() }

  /** A new engine life: what the last one saw no longer applies. */
  @Synchronized
  fun reset(agentId: String) {
    agents.remove(agentId)
  }

  @Synchronized
  private fun due(agentId: String, event: EngineEvent): Alert? {
    val session = event.sessionId ?: return null
    val state = agents.getOrPut(agentId) { AgentState() }
    if (event.childCreated) {
      state.children += session
      if (state.children.size > maxChildren) state.children.remove(state.children.first())
      return null
    }
    val alert = when (event.kind) {
      Kind.FINISHED -> Alert.FINISHED.takeIf { session !in state.children }
      Kind.FAILED -> Alert.FAILED.takeIf { session !in state.children }
      Kind.WAITING -> Alert.WAITING
      Kind.WORKING -> {
        if (state.last?.second == session) state.last = null
        null
      }
      Kind.GONE -> {
        state.children -= session
        if (state.last?.second == session) state.last = null
        null
      }
      Kind.STOPPED, Kind.OTHER -> null
    } ?: return null
    val key = alert to session
    if (state.last == key) return null
    state.last = key
    return alert
  }

  private companion object {
    const val MAX_CHILDREN = 256
  }
}
