package com.phonecando.models.jobs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RateMeterTest {
  private var t = 0L
  private val meter = RateMeter(windowMillis = 5_000, minSpanMillis = 500, now = { t })

  @Test
  fun `no rate from one sample or a short span`() {
    assertNull(meter.add(0))
    t = 100
    assertNull(meter.add(1_000))
  }

  @Test
  fun `bytes per second over the window`() {
    meter.add(0)
    t = 1_000
    assertEquals(2_000_000L, meter.add(2_000_000))
    t = 2_000
    assertEquals(1_500_000L, meter.add(3_000_000))
  }

  @Test
  fun `old samples leave the window`() {
    meter.add(0)
    t = 1_000
    meter.add(10_000_000)
    t = 7_000
    meter.add(11_000_000)
    t = 8_000
    // From t=7000 on: 1 MB in a second.
    assertEquals(1_000_000L, meter.add(12_000_000))
  }

  @Test
  fun `a count that goes back starts over`() {
    meter.add(5_000_000)
    t = 1_000
    assertNull(meter.add(0))
    t = 2_000
    assertEquals(1_000L, meter.add(1_000))
  }
}
