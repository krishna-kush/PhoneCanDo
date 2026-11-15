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
// - A WAITING alert is over once its session moves on (WORKING: answered,
//   from the notice or the app; a verdict, STOPPED or GONE): Due.waitOver,
//   so its notice goes unless a new alert takes the slot.
// - An event without a session never alerts; neither does an interrupted
//   run (the user stopped it; the kind maps it to OTHER).
// - Nothing posts while PhoneCanDo is in front: `inFront` is asked only
//   when an alert is due, and the alert still counts as given, so the same
//   one does not come later. It is still due (Due.post false): the app
//   hears of a finished run either way.
class AlertRules(private val maxChildren: Int = MAX_CHILDREN) {
  enum class Alert(val text: String) {
    FINISHED("Finished. Tap to see the result."),
    FAILED("Stopped with an error. Tap to see what happened."),
    WAITING("Waiting for your answer."),
  }

  /**
   * An alert an event calls for (null: none), and whether it posts
   * (PhoneCanDo is not in front); [waitOver]: the WAITING alert its session
   * gave is over.
   */
  data class Due(val alert: Alert?, val post: Boolean, val waitOver: Boolean = false)

  private class AgentState {
    // Oldest first, so the oldest is dropped past the cap.
    val children = LinkedHashSet<String>()
    var last: Pair<Alert, String>? = null
  }

  private val agents = HashMap<String, AgentState>()

  /** The alert this event calls for, posted or not, and whether a wait is over; null for neither. */
  fun onEvent(agentId: String, event: EngineEvent, inFront: () -> Boolean): Due? {
    val (alert, over) = due(agentId, event)
    if (alert == null) return if (over) Due(null, post = false, waitOver = true) else null
    return Due(alert, post = !inFront(), waitOver = over)
  }

  /** A new engine life: what the last one saw no longer applies. */
  @Synchronized
  fun reset(agentId: String) {
    agents.remove(agentId)
  }

  // The alert due, and whether the session's WAITING alert is over.
  @Synchronized
  private fun due(agentId: String, event: EngineEvent): Pair<Alert?, Boolean> {
    val session = event.sessionId ?: return null to false
    val state = agents.getOrPut(agentId) { AgentState() }
    if (event.childCreated) {
      state.children += session
      if (state.children.size > maxChildren) state.children.remove(state.children.first())
      return null to false
    }
    val over = state.last == (Alert.WAITING to session) && event.kind in MOVED_ON
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
      Kind.STOPPED -> {
        if (over) state.last = null
        null
      }
      Kind.OTHER -> null
    } ?: return null to over
    val key = alert to session
    if (state.last == key) return null to over
    state.last = key
    return alert to over
  }

  private companion object {
    const val MAX_CHILDREN = 256

    // What moves a session on from waiting for your answer.
    val MOVED_ON = setOf(Kind.WORKING, Kind.FINISHED, Kind.FAILED, Kind.STOPPED, Kind.GONE)
  }
}
