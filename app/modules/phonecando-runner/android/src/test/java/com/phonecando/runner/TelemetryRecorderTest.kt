package com.phonecando.runner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for what an unexpected engine exit keeps of its stderr tail
// (TelemetryRecorder.engineDiedIn, read back with TelemetryStore.read, over
// an in-memory store, MapPrefs). "telemetry_enabled" is TelemetryStore's
// K_ENABLED, the on/off choice.
class TelemetryRecorderTest {
  @Test fun onlyANewUnexpectedExitReplacesTheTail() {
    val p = MapPrefs()
    TelemetryRecorder.engineDiedIn(p, 1, "first", failedBoot = false, diedAt = 1L)
    TelemetryStore.read(p, consume = true)
    TelemetryRecorder.engineDiedIn(p, 2, "second", failedBoot = true, diedAt = 2L)
    val s = TelemetryStore.read(p, consume = true)
    assertEquals("second", s.lastStderrTail)
    assertEquals(2, s.lastExitCode)
    assertEquals(1, s.died)
    assertEquals(1, s.startFails)
    // An exit that left no output clears the old tail, so it is never
    // attached to a report about a later exit.
    TelemetryRecorder.engineDiedIn(p, 3, null, failedBoot = false, diedAt = 3L)
    assertNull(TelemetryStore.read(p, consume = false).lastStderrTail)
  }

  @Test fun noTailIsKeptWhileSharingIsOff() {
    val p = MapPrefs()
    p.map["telemetry_enabled"] = false
    TelemetryRecorder.engineDiedIn(p, 9, "output from the off period", failedBoot = false, diedAt = 9L)
    val s = TelemetryStore.read(p, consume = false)
    assertNull(s.lastStderrTail)
    // The exit itself is still counted locally (the app discards it while off).
    assertEquals(9, s.lastExitCode)
  }
}
