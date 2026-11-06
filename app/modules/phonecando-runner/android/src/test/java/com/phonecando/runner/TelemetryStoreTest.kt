package com.phonecando.runner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for what a consume clears and keeps (TelemetryStore.read over
// an in-memory store, MapPrefs). The raw keys mirror TelemetryStore's K_*
// names, as an older build or the recorder itself writes them.
class TelemetryStoreTest {
  private val crash =
    "[{\"id\":\"c1\",\"ts\":1750000000000,\"className\":\"java.lang.IllegalStateException\"," +
      "\"message\":\"m\",\"frames\":[\"a.B.c(B.kt:1)\"],\"thread\":\"main\",\"version\":\"0.1.3\"}]"

  private fun fullStore(): MapPrefs {
    val p = MapPrefs()
    // The exit is recorded while sharing is on (a tail is kept only then);
    // the store below then switches sharing off to prove the flag survives consume.
    TelemetryRecorder.engineDiedIn(p, 137, "killed at <path>", failedBoot = false, diedAt = 1_750_000_000_500L)
    p.map.putAll(
      mapOf(
        "telemetry_enabled" to false,
        "low_memory_trims" to 2,
        "engine_starts" to 3,
        "engine_start_fails" to 1,
        "engine_port_squats" to 1,
        "engine_last_boot_ms" to 1200L,
        "session_creates" to 4,
        "tool_calls" to "{\"notify\":2,\"pce_act\":5}",
        "native_crashes" to crash,
        "a_key_an_older_build_left" to 7,
      ),
    )
    return p
  }

  @Test fun consumeKeepsTheStderrTailAndClearsEverythingElse() {
    val p = fullStore()
    val first = TelemetryStore.read(p, consume = true)
    assertEquals(2, first.lowMemoryTrims)
    assertEquals(3, first.starts)
    assertEquals(1, first.startFails)
    assertEquals(1, first.died)
    assertEquals(1, first.portSquats)
    assertEquals(137, first.lastExitCode)
    assertEquals(1_750_000_000_500L, first.lastDiedAt)
    assertEquals("killed at <path>", first.lastStderrTail)
    assertEquals(1200L, first.lastBootMs)
    assertEquals(mapOf("notify" to 2, "pce_act" to 5), first.toolCalls)
    assertEquals(4, first.sessionCreates)
    assertEquals(listOf("c1"), first.crashes.map { it["id"] })

    // Only the on/off choice and the tail are left, written durably.
    assertEquals(setOf("telemetry_enabled", "engine_last_stderr_tail"), p.map.keys)
    assertEquals(1, p.commits)

    val second = TelemetryStore.read(p, consume = true)
    assertEquals(0, second.lowMemoryTrims)
    assertEquals(0, second.starts)
    assertEquals(0, second.startFails)
    assertEquals(0, second.died)
    assertEquals(0, second.portSquats)
    assertNull(second.lastExitCode)
    assertNull(second.lastDiedAt)
    assertNull(second.lastBootMs)
    assertEquals(emptyMap<String, Int>(), second.toolCalls)
    assertEquals(0, second.sessionCreates)
    assertEquals(0, second.crashes.size)
    assertEquals("killed at <path>", second.lastStderrTail)
    assertEquals(false, p.map["telemetry_enabled"])
  }

  @Test fun aPeekChangesNothing() {
    val p = fullStore()
    val before = LinkedHashMap(p.map)
    val peek = TelemetryStore.read(p, consume = false)
    assertEquals(3, peek.starts)
    assertEquals(before, p.map)
    assertEquals(0, p.commits)
  }
}
