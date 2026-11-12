package com.phonecando.runner.bridge

import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

// Moves the screen line on in time (ScreenLease.tick): a holder idle past
// the lease's time, or a reservation nobody claimed, passes the screen to
// the next in line even while no agent calls the bridge, so a waiter hears
// it is theirs. One daemon thread per open bridge; it sleeps with the phone.
class ScreenTicker(
  private val lease: ScreenLease,
  private val alive: (agentId: String) -> Boolean,
  private val periodMs: Long = 1_000,
) {
  private var timer: ScheduledExecutorService? = null

  @Synchronized
  fun start() {
    if (timer != null) return
    timer = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "phonecando-screen-line").apply { isDaemon = true } }
      .also { it.scheduleWithFixedDelay({ runCatching { lease.tick(alive) } }, periodMs, periodMs, TimeUnit.MILLISECONDS) }
  }

  @Synchronized
  fun stop() {
    timer?.shutdownNow()
    timer = null
  }
}
