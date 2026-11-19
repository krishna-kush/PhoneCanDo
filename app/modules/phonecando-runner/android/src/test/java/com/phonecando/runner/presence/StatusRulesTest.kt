package com.phonecando.runner.presence

import com.phonecando.runner.presence.StatusRules.Change
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Cleaning a status line, ignoring repeats, clearing it and letting it go stale.
class StatusRulesTest {
  @Test fun aLineIsOneLineWithoutControls() {
    assertEquals("Reading the logs", StatusRules.clean("  Reading\nthe\t logs \u0007"))
    assertEquals("ab", StatusRules.clean("a​b\u0000"))
    assertNull(StatusRules.clean(""))
    assertNull(StatusRules.clean(" \n\u0001 "))
  }

  @Test fun aLongLineIsCutWithAnEllipsis() {
    val exact = "x".repeat(80)
    assertEquals(exact, StatusRules.clean(exact))
    val cut = StatusRules.clean("y".repeat(81))!!
    assertEquals(80, cut.length)
    assertTrue(cut.endsWith("…"))
    // A space before the cut goes.
    assertEquals("a".repeat(78) + "…", StatusRules.clean("a".repeat(78) + " bcd"))
    // Characters, not UTF-16 units.
    val emoji = "😀".repeat(81)
    val cutEmoji = StatusRules.clean(emoji)!!
    assertEquals(80, cutEmoji.codePointCount(0, cutEmoji.length))
  }

  @Test fun moods() {
    assertEquals(StatusMood.WORKING, StatusRules.mood(null))
    assertEquals(StatusMood.THINKING, StatusRules.mood("thinking"))
    assertEquals(StatusMood.WAITING, StatusRules.mood("Waiting"))
    assertNull(StatusRules.mood("sleepy"))
  }

  @Test fun theSameLineWithinASecondIsIgnored() {
    val s = AgentStatus("Testing", StatusMood.WORKING, 1_000)
    assertEquals(Change.Keep, StatusRules.change(s, "Testing", StatusMood.WORKING, 1_999))
    // Later it only freshens the time; another mood or text is a change.
    assertEquals(Change.Set(s.copy(at = 2_000)), StatusRules.change(s, "Testing", StatusMood.WORKING, 2_000))
    assertEquals(Change.Set(s.copy(mood = StatusMood.WAITING, at = 1_500)), StatusRules.change(s, "Testing", StatusMood.WAITING, 1_500))
    assertEquals(Change.Set(AgentStatus("Fixing", StatusMood.WORKING, 1_500)), StatusRules.change(s, "Fixing", StatusMood.WORKING, 1_500))
    assertEquals(Change.Set(AgentStatus("New", StatusMood.THINKING, 7)), StatusRules.change(null, "New", StatusMood.THINKING, 7))
  }

  @Test fun anEmptyLineClears() {
    val s = AgentStatus("Testing", StatusMood.WORKING, 1_000)
    assertEquals(Change.Clear, StatusRules.change(s, null, StatusMood.WORKING, 1_100))
    assertEquals(Change.Keep, StatusRules.change(null, null, StatusMood.WORKING, 1_100))
  }

  @Test fun aStatusGoesStaleAfterFifteenMinutes() {
    val s = AgentStatus("Testing", StatusMood.WORKING, 0)
    assertFalse(StatusRules.stale(s, 15 * 60_000L - 1))
    assertTrue(StatusRules.stale(s, 15 * 60_000L))
  }
}
