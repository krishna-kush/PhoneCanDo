package com.phonecando.runner.engine.tui

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// A terminal start Home asked for counts as watched until its view
// attaches, or for MAX_AGE_MS at most.
class HomeStartsTest {
  private var clock = 1_000L

  init {
    HomeStarts.now = { clock }
  }

  @After fun reset() {
    HomeStarts.attached("a")
    HomeStarts.attached("b")
    HomeStarts.now = { System.nanoTime() / 1_000_000 }
  }

  @Test fun anAskCountsUntilItsViewAttaches() {
    assertFalse(HomeStarts.pending("a"))
    HomeStarts.asked("a")
    clock += 5_000
    assertTrue(HomeStarts.pending("a"))
    assertFalse(HomeStarts.pending("b"))
    HomeStarts.attached("a")
    assertFalse(HomeStarts.pending("a"))
  }

  @Test fun anAskWhoseViewNeverCameRunsOut() {
    HomeStarts.asked("a")
    clock += HomeStarts.MAX_AGE_MS
    assertTrue(HomeStarts.pending("a"))
    clock += 1
    assertFalse(HomeStarts.pending("a"))
    // A new ask counts again.
    HomeStarts.asked("a")
    assertTrue(HomeStarts.pending("a"))
  }
}
