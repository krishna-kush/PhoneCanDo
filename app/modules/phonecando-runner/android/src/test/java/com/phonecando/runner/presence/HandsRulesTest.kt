package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease
import com.phonecando.runner.presence.HandsRules.Step
import com.phonecando.runner.presence.HandsRules.Then
import org.junit.Assert.assertEquals
import org.junit.Test

// Every act against every hand-over: what starts, what ends and what the
// agent hears.
class HandsRulesTest {
  private val seat = ScreenLease.Seat("a1", "opencode")
  private val watch = HandOver("a1", "opencode", HandMode.WATCH, HandBy.AGENT, "pick a photo", 5)
  private val paused = watch.copy(mode = HandMode.PAUSED, by = HandBy.USER, why = null)

  private fun user(act: UserAct, now: HandOver?, target: ScreenLease.Seat? = seat, waiting: Boolean = false) =
    HandsRules.user(act, now, target, waiting, at = 9)

  @Test fun letMeAndStopStartAHandOverForTheDriver() {
    assertEquals(
      Step.Started(HandOver("a1", "opencode", HandMode.WATCH, HandBy.USER, null, 9)),
      user(UserAct.LET_ME, null),
    )
    assertEquals(
      Step.Started(HandOver("a1", "opencode", HandMode.PAUSED, HandBy.USER, null, 9)),
      user(UserAct.STOP, null),
    )
  }

  @Test fun nothingStartsWithNobodyAtTheScreen() {
    assertEquals(Step.Refused, user(UserAct.LET_ME, null, target = null))
    assertEquals(Step.Refused, user(UserAct.STOP, null, target = null))
  }

  @Test fun stopTurnsAWatchPausedAndStopsTheRun() {
    assertEquals(Step.Started(watch.copy(mode = HandMode.PAUSED), switched = true), user(UserAct.STOP, watch))
    assertEquals(Step.Refused, user(UserAct.STOP, paused))
    assertEquals(Step.Refused, user(UserAct.LET_ME, watch))
    assertEquals(Step.Refused, user(UserAct.LET_ME, paused))
  }

  @Test fun givingBackEndsAWatchOnly() {
    assertEquals(Step.Ended(watch, Then.BACK), user(UserAct.GIVE_BACK, watch, waiting = true))
    // Not waiting: its turn ended, so it hears the note.
    assertEquals(Step.Ended(watch, Then.RESUME), user(UserAct.GIVE_BACK, watch, waiting = false))
    assertEquals(Step.Refused, user(UserAct.GIVE_BACK, paused))
    assertEquals(Step.Refused, user(UserAct.GIVE_BACK, null))
  }

  @Test fun startAgainAndLeaveEndAPauseOnly() {
    assertEquals(Step.Ended(paused, Then.RESUME), user(UserAct.START_AGAIN, paused))
    // Waiting for you (phone_wait_for_user): its call returns instead of a note.
    assertEquals(Step.Ended(paused, Then.BACK), user(UserAct.START_AGAIN, paused, waiting = true))
    assertEquals(Step.Ended(paused, Then.NONE), user(UserAct.LEAVE, paused))
    for (act in listOf(UserAct.START_AGAIN, UserAct.LEAVE)) {
      assertEquals(Step.Refused, user(act, watch))
      assertEquals(Step.Refused, user(act, null))
    }
  }

  @Test fun anAgentHandsOverOnlyWhileNoneIsOn() {
    assertEquals(
      Step.Started(HandOver("a2", "claude", HandMode.WATCH, HandBy.AGENT, "2FA code", 3)),
      HandsRules.agent("a2", "claude", "2FA code", private = false, now = null, at = 3),
    )
    // Private: it can't see, and ends its turn by itself.
    assertEquals(
      Step.Started(HandOver("a2", "claude", HandMode.PAUSED, HandBy.AGENT, "password", 3)),
      HandsRules.agent("a2", "claude", "password", private = true, now = null, at = 3),
    )
    assertEquals(Step.Refused, HandsRules.agent("a2", "claude", "x", private = false, now = watch, at = 3))
    assertEquals(Step.Refused, HandsRules.agent("a1", "opencode", "x", private = true, now = paused, at = 3))
  }

  @Test fun theResumeNoteSaysWhatHappened() {
    assertEquals(HandsText.AFTER_WATCH, HandsText.resume(HandMode.WATCH))
    assertEquals(HandsText.AFTER_PAUSED, HandsText.resume(HandMode.PAUSED))
  }
}
