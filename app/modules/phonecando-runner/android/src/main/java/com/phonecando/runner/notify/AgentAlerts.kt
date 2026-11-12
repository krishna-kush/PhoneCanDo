package com.phonecando.runner.notify

import android.content.Context
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.agents.AgentDirectory

// An agent's alert from its engine's event stream (EngineStreams): finished,
// failed or waiting for your answer, as AlertRules decides, posted only
// while PhoneCanDo is not in front. It goes in the agent's slot
// (AgentNotices.SLOT, shared with the /app return notice), titled with the
// agent's name: a new alert replaces the last, and after the first sound
// it updates quietly until the user has seen it. A tap opens that agent's
// Home; showing the agent's chat takes it down (dismiss).
// An agent that asks while it is driving the phone (`drivingScreen`: it
// holds the screen and has not given it back) also brings PhoneCanDo
// forward on its Home, so the question is in front of the user instead of
// behind the app being automated. The alert still goes up first: Android
// may block the background start, and the chat showing takes it down.
internal class AgentAlerts(
  private val context: Context,
  private val agents: AgentDirectory,
  private val drivingScreen: (agentId: String) -> Boolean,
) {
  private val rules = AlertRules()
  private val notices = AgentNotices(context)

  fun onEvent(agentId: String, event: EngineEvent) {
    val alert = rules.onEvent(agentId, event) { AppForeground.isForeground(context) } ?: return
    val name = agents.get(agentId)?.name ?: return
    notices.post(AgentNotices.Notice(agentId, AgentNotices.SLOT, name, alert.text, quietUpdate = true))
    if (alert == AlertRules.Alert.WAITING && drivingScreen(agentId)) {
      LaunchTargets.open(context, LaunchTarget("home", agentId))
    }
  }

  /** The agent's engine is ready again (a new stream). */
  fun reset(agentId: String) = rules.reset(agentId)

  companion object {
    /** The user has the agent's chat in front: its notice goes. */
    fun dismiss(context: Context, agentId: String) = AgentNotices(context).cancel(agentId, AgentNotices.SLOT)
  }
}
