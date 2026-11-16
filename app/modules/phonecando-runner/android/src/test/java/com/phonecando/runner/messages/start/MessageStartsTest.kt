package com.phonecando.runner.messages.start

import com.phonecando.runner.messages.MessageRules
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// A start a message asked for is pending until its set went in or its
// engine is gone, and one whose engine never began is given up once.
class MessageStartsTest {
  private var now = 1_000_000L
  private val starts = MessageStarts { now }

  @Test fun pendingUntilItsSetWentInOrItsEngineIsGone() {
    assertFalse(starts.pending("b"))
    starts.asked("b")
    starts.asked("b")
    assertTrue(starts.pending("b"))
    starts.began("b")
    assertTrue(starts.woke("b"))
    assertFalse(starts.pending("b"))
    assertFalse(starts.woke("b"))
    starts.asked("b")
    assertTrue(starts.gone("b"))
    assertFalse(starts.gone("b"))
    // Ready, it came: an engine gone later is no failed start.
    starts.asked("b")
    starts.began("b")
    starts.ready("b")
    assertFalse(starts.gone("b"))
    assertFalse(starts.pending("b"))
  }

  @Test fun aSetLongAfterTheAskIsNotTheStartsOwn() {
    starts.asked("b")
    starts.began("b")
    now += MessageRules.WAKE_TTL_MS
    assertFalse(starts.woke("b"))
  }

  @Test fun aStartThatNeverBeganIsGivenUpOnce() {
    starts.asked("b")
    now += MessageRules.START_GIVE_UP_MS - 1
    assertFalse(starts.stale("b"))
    now += 1
    assertTrue(starts.stale("b"))
    assertFalse(starts.stale("b"))
    assertFalse(starts.pending("b"))
    // One that began is never stale; its engine says how it went.
    starts.asked("c")
    starts.began("c")
    now += 10 * MessageRules.START_GIVE_UP_MS
    assertFalse(starts.stale("c"))
    assertTrue(starts.pending("c"))
  }
}
