package com.phonecando.runner.bridge

import org.junit.Assert.assertEquals
import org.junit.Test

// The overlay hears who drives once per change, and again when a new
// indicator comes up.
class DriverWatchTest {
  private var now = 0L
  private val lease = ScreenLease(30_000) { now }
  private val alive: (String) -> Boolean = { true }

  private class Seen : ScreenIndicator {
    val shown = mutableListOf<String?>()

    override fun show(driver: ScreenLease.Seat?) {
      shown += driver?.name
    }
  }

  @Test fun showsOnlyChanges() {
    val seen = Seen()
    val watch = DriverWatch(lease) { seen }
    watch.check()
    val ticket = (lease.claim("a1", "Builder", alive) as ScreenLease.Granted).ticket
    watch.check()
    watch.check()
    lease.done(ticket)
    now += 30_000
    watch.check()
    assertEquals(listOf(null, "Builder", null), seen.shown)
  }

  @Test fun aNewIndicatorHearsTheDriverAtOnce() {
    var indicator: ScreenIndicator? = null
    val watch = DriverWatch(lease) { indicator }
    lease.claim("a1", "Builder", alive)
    watch.check()
    val seen = Seen()
    indicator = seen
    watch.check()
    watch.check()
    assertEquals(listOf<String?>("Builder"), seen.shown)
  }
}
