package com.phonecando.runner.engine

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the first prompt a start takes (StartPrompts): taken once,
// per agent, the newest wins, and one that waited too long is dropped.
class StartPromptsTest {
  private var now = 1_000L

  init {
    StartPrompts.now = { now }
  }

  @After fun clock() {
    StartPrompts.now = { System.nanoTime() / 1_000_000 }
  }

  @Test fun aPromptIsTakenOnceByItsAgent() {
    StartPrompts.put("a1", "check CI", newChat = false)
    assertNull(StartPrompts.take("a2"))
    assertEquals(StartPrompt("check CI", newChat = false), StartPrompts.take("a1"))
    assertNull(StartPrompts.take("a1"))
  }

  @Test fun theNewestWins() {
    StartPrompts.put("a1", "first", newChat = false)
    StartPrompts.put("a1", "second", newChat = true)
    assertEquals(StartPrompt("second", newChat = true), StartPrompts.take("a1"))
  }

  @Test fun oneThatWaitedTooLongIsDropped() {
    StartPrompts.put("a1", "late", newChat = true)
    now += StartPrompts.MAX_AGE_MS + 1
    assertNull(StartPrompts.take("a1"))
    StartPrompts.put("a1", "on time", newChat = true)
    now += StartPrompts.MAX_AGE_MS
    assertEquals("on time", StartPrompts.take("a1")?.prompt)
  }
}
