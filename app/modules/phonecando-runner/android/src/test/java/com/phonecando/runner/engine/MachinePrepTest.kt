package com.phonecando.runner.engine

import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MachinePrepTest {
  private var clock = 1_000L

  init {
    MachinePrep.now = { clock }
  }

  @After fun reset() {
    MachinePrep.take("a")
    MachinePrep.now = { System.nanoTime() / 1_000_000 }
  }

  @Test fun aMarkIsTakenOnce() {
    MachinePrep.mark("a")
    assertTrue(MachinePrep.take("a"))
    assertFalse(MachinePrep.take("a"))
  }

  @Test fun noMarkMeansTheAppReadiedIt() {
    assertFalse(MachinePrep.take("a"))
  }

  @Test fun aMarkWhoseStartNeverCameIsDropped() {
    MachinePrep.mark("a")
    clock += MachinePrep.MAX_AGE_MS + 1
    assertFalse(MachinePrep.take("a"))
  }
}
