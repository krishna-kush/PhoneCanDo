package com.phonecando.runner.messages

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// A run another agent's message started: on from the wake, through the run,
// off when it ends (or never shows up, or the engine stops); the hop it
// gives what the agent sends meanwhile.
class WakeTrackerTest {
  private var now = 0L
  private val wakes = WakeTracker { now }

  @Test fun onThroughTheRunOffAtItsEnd() {
    assertFalse(wakes.startedByAgent("a"))
    assertEquals(0, wakes.hopFor("a"))
    wakes.woke("a", hop = 0, workingNow = false)
    assertTrue(wakes.startedByAgent("a"))
    assertEquals(1, wakes.hopFor("a"))
    wakes.working(setOf("a"))
    now += 10 * 60_000
    wakes.working(setOf("a", "b"))
    assertTrue(wakes.startedByAgent("a"))
    wakes.working(setOf("b"))
    assertFalse(wakes.startedByAgent("a"))
    assertEquals(0, wakes.hopFor("a"))
  }

  @Test fun aWakeThatShowsNoRunExpires() {
    wakes.woke("a", hop = 1, workingNow = false)
    assertEquals(2, wakes.hopFor("a"))
    // Not in the working set yet, within the window: still on.
    wakes.working(emptySet())
    assertTrue(wakes.startedByAgent("a"))
    now += MessageRules.WAKE_START_MS + 1
    assertFalse(wakes.startedByAgent("a"))
  }

  @Test fun aRunAlreadyShowingEndsWithItsFirstLeave() {
    wakes.woke("a", hop = 0, workingNow = true)
    wakes.working(emptySet())
    assertFalse(wakes.startedByAgent("a"))
  }

  @Test fun theEngineStoppingEndsIt() {
    wakes.woke("a", hop = 0, workingNow = true)
    wakes.ended("a")
    assertFalse(wakes.startedByAgent("a"))
  }
}
