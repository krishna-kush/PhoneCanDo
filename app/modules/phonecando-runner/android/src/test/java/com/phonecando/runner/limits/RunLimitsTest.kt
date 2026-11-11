package com.phonecando.runner.limits

import com.phonecando.runner.MapPrefs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

// The user's run limits: what JS may send, how a cap is kept, and the
// store over the runner's prefs.
class RunLimitsTest {
  @Test fun aCapIsAWholeNumberFromOneToNinetyNine() {
    assertNull(RunLimits.cap(null))
    assertEquals(3, RunLimits.cap(3.0))
    assertEquals(3, RunLimits.cap(2.6))
    assertEquals(1, RunLimits.cap(0.0))
    assertEquals(1, RunLimits.cap(-5.0))
    assertEquals(99, RunLimits.cap(100.0))
    assertEquals(99, RunLimits.cap(1e12))
    assertNull(RunLimits.cap(Double.NaN))
    assertNull(RunLimits.cap(Double.POSITIVE_INFINITY))
  }

  @Test fun readsWhatJsSends() {
    assertEquals(RunLimits(4, null), RunLimits.fromJs(mapOf("maxAgents" to 4.0, "maxModels" to null)))
    assertEquals(RunLimits(null, 2), RunLimits.fromJs(mapOf("maxModels" to 2)))
    assertEquals(RunLimits.NONE, RunLimits.fromJs(mapOf("maxAgents" to "3", "maxModels" to true)))
    assertEquals(RunLimits.NONE, RunLimits.fromJs(emptyMap()))
  }

  @Test fun crossesTheBridgeAsNumbers() {
    assertEquals(mapOf("maxAgents" to 3.0, "maxModels" to null), RunLimits(3, null).toMap())
  }

  @Test fun theStoreKeepsBothCapsAndNoneByDefault() {
    val prefs = MapPrefs()
    assertEquals(RunLimits.NONE, RunLimitStore(prefs).read())
    assertEquals(RunLimits(5, 1), RunLimitStore(prefs).write(RunLimits(5, 1)))
    assertEquals(RunLimits(5, 1), RunLimitStore(prefs).read())
    RunLimitStore(prefs).write(RunLimits(null, 1))
    assertFalse(prefs.map.containsKey(RunLimitStore.K_MAX_AGENTS))
    assertEquals(RunLimits(null, 1), RunLimitStore(prefs).read())
  }

  @Test fun aStoredValueOutOfRangeOrOfAnotherTypeIsNoCap() {
    val prefs = MapPrefs()
    prefs.map[RunLimitStore.K_MAX_AGENTS] = 0
    prefs.map[RunLimitStore.K_MAX_MODELS] = "two"
    assertEquals(RunLimits.NONE, RunLimitStore(prefs).read())
  }

  @Test fun aWriteIsSeenByTheNextReadOfTheSameStore() {
    val store = RunLimitStore(MapPrefs())
    assertEquals(RunLimits.NONE, store.read())
    store.write(RunLimits(2, 3))
    assertEquals(RunLimits(2, 3), store.read())
  }
}
