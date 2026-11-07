package com.phonecando.runner.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The screen lease: one agent drives, the others are told who and how long.
class ScreenLeaseTest {
  private var now = 1_000L
  private val lease = ScreenLease(idleMs = 30_000) { now }
  private val alive = mutableSetOf("a1", "a2", "a3")

  private fun claim(id: String) = lease.claim(id, "name-$id") { it in alive }

  private fun granted(id: String): ScreenLease.Ticket {
    val claim = claim(id)
    assertTrue("$id should hold the screen, got $claim", claim is ScreenLease.Granted)
    return (claim as ScreenLease.Granted).ticket
  }

  @Test fun firstCallerTakesTheScreenAndKeepsPassing() {
    lease.done(granted("a1"))
    now += 10_000
    lease.done(granted("a1"))
    assertEquals("a1", lease.holderId())
  }

  @Test fun othersAreBusyWithTheHolderNameAndWait() {
    lease.done(granted("a1"))
    now += 12_000
    val busy = claim("a2") as ScreenLease.Busy
    assertEquals("name-a1", busy.holderName)
    assertEquals(18_000, busy.retryAfterMs)
  }

  @Test fun idleIsCountedFromTheEndOfTheLastRequest() {
    val ticket = granted("a1")
    // A long act: still running well past the idle time.
    now += 90_000
    val busy = claim("a2") as ScreenLease.Busy
    assertEquals(30_000, busy.retryAfterMs)
    lease.done(ticket)
    now += 29_999
    assertTrue(claim("a2") is ScreenLease.Busy)
    now += 1
    lease.done(granted("a2"))
    assertEquals("a2", lease.holderId())
  }

  @Test fun idleExpiryHandsTheScreenOver() {
    lease.done(granted("a1"))
    now += 30_000
    lease.done(granted("a2"))
    val busy = claim("a1") as ScreenLease.Busy
    assertEquals("name-a2", busy.holderName)
  }

  @Test fun aHolderWhoseEngineIsGoneLosesTheLease() {
    val ticket = granted("a1")
    alive.remove("a1")
    lease.done(granted("a2"))
    // The old request ending late must not touch the new holder.
    lease.done(ticket)
    now += 1_000
    val busy = claim("a3") as ScreenLease.Busy
    assertEquals("name-a2", busy.holderName)
    assertEquals(29_000, busy.retryAfterMs)
  }

  @Test fun releaseGivesTheScreenBackAtOnce() {
    lease.done(granted("a1"), release = true)
    assertNull(lease.holderId())
    lease.done(granted("a2"))
    assertEquals("a2", lease.holderId())
  }

  @Test fun releaseWaitsForTheHoldersOtherRequests() {
    val act = granted("a1")
    lease.done(granted("a1"), release = true)
    assertEquals("a1", lease.holderId())
    lease.done(act)
    now += 1
    assertTrue(claim("a2") is ScreenLease.Busy)
  }
}
