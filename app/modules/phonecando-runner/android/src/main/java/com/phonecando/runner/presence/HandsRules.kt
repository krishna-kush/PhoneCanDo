package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease

// Who has the phone's controls: the agent driving, or you after a
// hand-over. One hand-over at a time per phone. Row by row:
//   LET_ME        none on, an agent drives or holds the screen   WATCH for that agent (you drive, it may observe)
//   STOP          none on, an agent drives or holds the screen   PAUSED for that agent (it can't see or touch)
//   STOP          WATCH on                                       the same hand-over turns PAUSED
//   GIVE_BACK     WATCH on                                       ends: a waiting call returns back, else the resume note
//   START_AGAIN   PAUSED on                                      ends: a waiting call returns back, else the resume note
//   LEAVE         PAUSED on                                      ends: no note, the screen goes; a run still going stays
//                                                                off it (PresenceStore), its next run drives as normal
// Nothing here stops an agent's run: a paused agent keeps working on
// whatever is not the screen, and only its screen calls are refused.
//   anything else                                                not now
// An agent's mobile_hand_over starts one (WATCH, or PAUSED when private)
// only while none is on; the screen side of it (it holds the screen, or
// the screen is free and it is unlocked) is the lease's, in the router.
// A run that ends changes nothing: the hand-over waits for you. Pure.
object HandsRules {
  sealed interface Step {
    /** A hand-over starts, or WATCH turns PAUSED ([switched]). */
    data class Started(val handOver: HandOver, val switched: Boolean = false) : Step

    /** [handOver] ends; [then] what the agent hears of it. */
    data class Ended(val handOver: HandOver, val then: Then) : Step

    /** Your button does not apply now, or (an agent's) you already have the controls. */
    data object Refused : Step
  }

  enum class Then {
    /** Its waiting call (/hands/wait or /hands/over) returns back: true. */
    BACK,

    /** The resume note goes to it (HandsText.resume), which may wake it. */
    RESUME,

    /** Nothing: it stays as it is. */
    NONE,
  }

  /**
   * Your [act] with [now] on; [target] is the agent driving or holding the
   * screen; [waiting]: the hand-over's agent is blocked in a waiting call.
   */
  fun user(act: UserAct, now: HandOver?, target: ScreenLease.Seat?, waiting: Boolean, at: Long): Step = when (act) {
    UserAct.LET_ME -> if (now == null && target != null) start(target, HandMode.WATCH, at) else Step.Refused
    UserAct.STOP -> when {
      now == null && target != null -> start(target, HandMode.PAUSED, at)
      now?.mode == HandMode.WATCH -> Step.Started(now.copy(mode = HandMode.PAUSED), switched = true)
      else -> Step.Refused
    }
    UserAct.GIVE_BACK ->
      if (now?.mode == HandMode.WATCH) Step.Ended(now, if (waiting) Then.BACK else Then.RESUME) else Step.Refused
    UserAct.START_AGAIN ->
      if (now?.mode == HandMode.PAUSED) Step.Ended(now, if (waiting) Then.BACK else Then.RESUME) else Step.Refused
    UserAct.LEAVE -> if (now?.mode == HandMode.PAUSED) Step.Ended(now, Then.NONE) else Step.Refused
  }

  /** The agent hands you the controls: WATCH, or PAUSED when [private]; Refused while one is on. */
  fun agent(agentId: String, agentName: String, why: String, private: Boolean, now: HandOver?, at: Long): Step {
    if (now != null) return Step.Refused
    val mode = if (private) HandMode.PAUSED else HandMode.WATCH
    return Step.Started(HandOver(agentId, agentName, mode, HandBy.AGENT, why, at))
  }

  private fun start(target: ScreenLease.Seat, mode: HandMode, at: Long) =
    Step.Started(HandOver(target.agentId, target.name, mode, HandBy.USER, null, at))
}
