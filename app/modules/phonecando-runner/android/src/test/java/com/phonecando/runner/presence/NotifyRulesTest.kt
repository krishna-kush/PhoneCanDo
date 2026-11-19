package com.phonecando.runner.presence

import com.phonecando.runner.presence.NotifyRules.Verdict
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// mobile_notify's limits: a minute, an hour, the chat on screen.
class NotifyRulesTest {
  private var now = 0L
  private val rules = NotifyRules { now }

  private fun post(agentId: String = "a1"): Verdict = rules.check(agentId, chatOnScreen = false).also {
    if (it == Verdict.Post) rules.posted(agentId)
  }

  @Test fun oneAMinute() {
    assertEquals(Verdict.Post, post())
    now += 20_000
    assertEquals(Verdict.TooOften(40_000), post())
    // Another agent has its own windows.
    assertEquals(Verdict.Post, post("a2"))
    now += 40_000
    assertEquals(Verdict.Post, post())
  }

  @Test fun fiveAnHour() {
    repeat(5) {
      assertEquals(Verdict.Post, post())
      now += 60_000
    }
    // The first of the five leaves the hour 56 minutes from now.
    assertEquals(Verdict.TooOften(55 * 60_000L), post())
    now += 55 * 60_000L
    assertEquals(Verdict.Post, post())
  }

  @Test fun onlyPostsCount() {
    assertEquals(Verdict.Post, rules.check("a1", chatOnScreen = false))
    now += 1
    assertEquals(Verdict.Post, rules.check("a1", chatOnScreen = false))
  }

  @Test fun notWhileItsChatIsOnScreen() {
    assertEquals(Verdict.Skip(NotifyRules.ON_SCREEN), rules.check("a1", chatOnScreen = true))
    assertEquals(Verdict.Post, post())
    rules.forget("a1")
    assertEquals(Verdict.Post, post())
  }

  @Test fun theChatIsOnScreenOnlyWithTheAppInFront() {
    assertTrue(NotifyRules.chatOnScreen(appShown = true, openAgent = "a1", agentId = "a1"))
    assertFalse(NotifyRules.chatOnScreen(appShown = false, openAgent = "a1", agentId = "a1"))
    assertFalse(NotifyRules.chatOnScreen(appShown = true, openAgent = "a2", agentId = "a1"))
    assertFalse(NotifyRules.chatOnScreen(appShown = true, openAgent = null, agentId = "a1"))
  }
}
