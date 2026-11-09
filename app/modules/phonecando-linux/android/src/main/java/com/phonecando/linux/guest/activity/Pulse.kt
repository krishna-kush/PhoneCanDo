package com.phonecando.linux.guest.activity

import java.io.Closeable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * Calls [onTick] every [periodMillis] on a thread of its own until closed,
 * so a guest script that prints nothing for minutes still reports. A tick
 * that throws is skipped; the next one runs.
 */
internal class Pulse(private val periodMillis: Long, private val onTick: () -> Unit) : Closeable {
  private val stop = CountDownLatch(1)
  private val worker = thread(isDaemon = true, name = "phonecando-guest-pulse") {
    while (!stop.await(periodMillis, TimeUnit.MILLISECONDS)) {
      try {
        onTick()
      } catch (_: RuntimeException) {
        // One missed event; the next tick reports again.
      }
    }
  }

  /** Stops the ticks; a tick under way finishes first, so no event follows this. */
  override fun close() {
    stop.countDown()
    worker.join(JOIN_MS)
  }

  private companion object {
    const val JOIN_MS = 5_000L
  }
}
