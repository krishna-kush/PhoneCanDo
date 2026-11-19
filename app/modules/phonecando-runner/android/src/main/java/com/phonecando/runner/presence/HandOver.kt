package com.phonecando.runner.presence

/** Who has the controls once the agent hands them over: you drive while it watches, or while it is paused. */
enum class HandMode { WATCH, PAUSED }

/** Who started the hand-over: you, with the mascot's buttons, or the agent (phone_hand_over). */
enum class HandBy { USER, AGENT }

/**
 * The phone's controls are yours for now, handed over from [agentId]:
 * WATCH, it still sees the screen and keeps running; PAUSED, it can't see
 * and its run is stopped until you start it again. [why] is the agent's
 * reason, null when you started it; [since] is elapsedRealtime.
 */
data class HandOver(
  val agentId: String,
  val agentName: String,
  val mode: HandMode,
  val by: HandBy,
  val why: String?,
  val since: Long,
)
