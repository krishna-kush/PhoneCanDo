package com.phonecando.linux.guest.activity

import com.phonecando.linux.jobs.ScriptActivity
import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for a script's activity: time since start, bytes and rate, on a fake clock and counter.
class ActivityMeterTest {
  private var clock = 50_000L
  private var counter: Long? = 7_000_000L

  @Test fun startsAtNothingAndCountsFromTheStart() {
    val meter = ActivityMeter({ counter }) { clock }
    assertEquals(ScriptActivity(0, 0, 0), meter.now())
    clock += 1_000
    counter = counter!! + 1_500_000
    meter.sample()
    clock += 1_000
    counter = counter!! + 1_500_000
    meter.sample()
    assertEquals(ScriptActivity(2, 3_000_000, 1_500_000), meter.now())
  }

  @Test fun theTimeRunsBetweenReadings() {
    val meter = ActivityMeter({ counter }) { clock }
    clock += 2_500
    assertEquals(2L, meter.now().elapsedSec)
    clock += 128_000
    assertEquals(130L, meter.now().elapsedSec)
  }

  @Test fun itSaysWhenThePhoneIsOffline() {
    var online: Boolean? = true
    val meter = ActivityMeter({ counter }, { online }) { clock }
    assertEquals(true, meter.now().online)
    online = false
    assertEquals("as of the last reading", true, meter.now().online)
    meter.sample()
    assertEquals(false, meter.now().online)
    online = null
    meter.sample()
    assertEquals(null, meter.now().online)
  }

  @Test fun anUncountableAppHasTimeOnly() {
    counter = null
    val meter = ActivityMeter({ counter }) { clock }
    clock += 3_000
    meter.sample()
    assertEquals(ScriptActivity(3, null, null), meter.now())
  }
}
