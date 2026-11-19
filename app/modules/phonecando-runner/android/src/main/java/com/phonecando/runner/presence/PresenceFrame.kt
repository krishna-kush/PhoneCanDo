package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease

/**
 * What every reader of the agents' presence sees at once: the agent
 * driving the phone now, the hand-over to you if there is one, and each
 * agent's status line (agentId to status).
 */
data class PresenceFrame(
  val driver: ScreenLease.Seat?,
  val handOver: HandOver?,
  val statuses: Map<String, AgentStatus>,
) {
  companion object {
    val EMPTY = PresenceFrame(null, null, emptyMap())
  }
}
