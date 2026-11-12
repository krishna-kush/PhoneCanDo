package com.phonecando.runner.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The screen lease: one agent drives, the others wait in line and are told
// who has the screen, their place, and when it is theirs.
class ScreenLeaseTest {
  private class Told : ScreenNotices {
    val notes = mutableListOf<String>()

    override fun waiting(holderId: String, waiterName: String) {
      notes += "waiting $holderId $waiterName"
    }

    override fun yours(agentId: String) {
      notes += "yours $agentId"
    }
  }

  private var now = 1_000L
  private val told = Told()
  private val lease = ScreenLease(idleMs = 30_000, notices = told) { now }
  private val alive = mutableSetOf("a1", "a2", "a3", "a4")
  private val isAlive: (String) -> Boolean = { it in alive }

  private fun claim(id: String, agentTurn: Boolean = false) = lease.claim(id, "name-$id", isAlive, agentTurn)

  private fun busy(id: String, agentTurn: Boolean = false): ScreenLease.Busy {
    val claim = claim(id, agentTurn)
    assertTrue("$id should wait, got $claim", claim is ScreenLease.Busy)
    return claim as ScreenLease.Busy
  }

  private fun waiting() = lease.line().waiting.map { it.agentId }

  private fun granted(id: String, agentTurn: Boolean = false): ScreenLease.Ticket {
    val claim = claim(id, agentTurn)
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

  @Test fun inUseWhileRunningOrRecent() {
    assertFalse(lease.inUse())
    val ticket = granted("a1")
    now += 90_000
    assertTrue(lease.inUse())
    lease.done(ticket)
    now += 29_999
    assertTrue(lease.inUse())
    now += 1
    // Still the holder, but no longer driving.
    assertFalse(lease.inUse())
    assertEquals("a1", lease.holderId())
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

  // The line

  @Test fun othersWaitInLineInOrderAndJoinOnce() {
    lease.done(granted("a1"))
    assertEquals(ScreenLease.Busy("name-a1", 30_000, 1), claim("a2"))
    assertEquals(2, busy("a3").place)
    now += 10_000
    // Asking again keeps the place, and the holder hears of each waiter once.
    assertEquals(ScreenLease.Busy("name-a1", 20_000, 1), claim("a2"))
    assertEquals(2, busy("a3").place)
    assertEquals(listOf("a2", "a3"), waiting())
    assertEquals(listOf("waiting a1 name-a2", "waiting a1 name-a3"), told.notes)
  }

  @Test fun releaseReservesTheScreenForTheFirstInLine() {
    val ticket = granted("a1")
    busy("a2")
    busy("a3")
    lease.done(ticket, release = true)
    assertEquals("yours a2", told.notes.last())
    assertNull(lease.holderId())
    assertEquals(ScreenLease.Line(ScreenLease.Seat("a2", "name-a2"), reserved = true, listOf(ScreenLease.Seat("a3", "name-a3"))), lease.line())
    // Only the reserved agent's claim takes it; the others keep their places.
    now += 5_000
    assertEquals(ScreenLease.Busy("name-a2", 25_000, 1), claim("a3"))
    assertEquals(ScreenLease.Busy("name-a2", 25_000, 2), claim("a1"))
    lease.done(granted("a2"))
    assertEquals("a2", lease.holderId())
    assertEquals(listOf("a3", "a1"), waiting())
  }

  @Test fun anIdleHolderPassesTheScreenWhenTimeMovesOn() {
    lease.done(granted("a1"))
    busy("a2")
    now += 29_999
    lease.tick(isAlive)
    assertEquals("a1", lease.holderId())
    now += 1
    lease.tick(isAlive)
    assertNull(lease.holderId())
    assertEquals(listOf("waiting a1 name-a2", "yours a2"), told.notes)
    // The old holder now waits behind the one it was reserved for.
    assertEquals(ScreenLease.Busy("name-a2", 30_000, 1), claim("a1"))
  }

  @Test fun anIdleHolderWithNobodyWaitingKeepsTheScreen() {
    lease.done(granted("a1"))
    now += 120_000
    lease.tick(isAlive)
    assertEquals("a1", lease.holderId())
    assertNull(lease.line().holder)
    assertTrue(told.notes.isEmpty())
  }

  @Test fun anUnclaimedReservationPassesToTheNext() {
    val ticket = granted("a1")
    busy("a2")
    busy("a3")
    lease.done(ticket, release = true)
    now += 29_999
    lease.tick(isAlive)
    assertEquals(ScreenLease.Seat("a2", "name-a2"), lease.line().holder)
    now += 1
    lease.tick(isAlive)
    assertEquals(ScreenLease.Seat("a3", "name-a3"), lease.line().holder)
    assertEquals("yours a3", told.notes.last())
    // The one that missed its turn joins the line again from the back.
    assertEquals(ScreenLease.Busy("name-a3", 30_000, 1), claim("a2"))
    lease.done(granted("a3"))
  }

  @Test fun goneAgentsLeaveTheLine() {
    lease.done(granted("a1"))
    busy("a2")
    busy("a3")
    alive.remove("a1")
    alive.remove("a2")
    lease.tick(isAlive)
    assertEquals("yours a3", told.notes.last())
    assertEquals(ScreenLease.Line(ScreenLease.Seat("a3", "name-a3"), reserved = true, emptyList()), lease.line())
    // A reserved agent whose engine is gone loses it too.
    busy("a4")
    alive.remove("a3")
    lease.done(granted("a4"))
  }

  @Test fun forgetDropsAnAgentAtOnce() {
    val ticket = granted("a1")
    busy("a2")
    busy("a3")
    lease.forget("a3")
    assertEquals(listOf("a2"), waiting())
    lease.forget("a1")
    assertNull(lease.holderId())
    assertEquals("yours a2", told.notes.last())
    // Its request ending late touches nothing.
    lease.done(ticket, release = true)
    lease.forget("a2")
    assertEquals(ScreenLease.Line(null, reserved = false, emptyList()), lease.line())
    lease.done(granted("a3"))
  }

  @Test fun aReservationIsNotInUse() {
    val ticket = granted("a1")
    busy("a2")
    lease.done(ticket, release = true)
    assertFalse(lease.inUse())
    lease.done(granted("a2"))
    assertTrue(lease.inUse())
  }

  @Test fun busyCountsTheWaitFromTheHoldersLastRequest() {
    val ticket = granted("a1")
    now += 50_000
    // Still running: a whole idle time to go.
    assertEquals(30_000, busy("a2").retryAfterMs)
    lease.done(ticket)
    now += 10_000
    assertEquals(20_000, busy("a3").retryAfterMs)
  }

  // Turns another agent's message started

  @Test fun anAgentTurnNeverTakesAFreeScreenOrJoinsTheLine() {
    assertEquals(ScreenLease.Refused, claim("a1", agentTurn = true))
    assertNull(lease.holderId())
    lease.done(granted("a2"))
    assertEquals(ScreenLease.Refused, claim("a1", agentTurn = true))
    assertTrue(waiting().isEmpty())
    assertTrue(told.notes.isEmpty())
  }

  @Test fun anAgentTurnGetsTheScreenTheLineHandsIt() {
    val ticket = granted("a1")
    // Its own earlier request, from a turn the user started, holds its place.
    busy("a2")
    assertEquals(ScreenLease.Busy("name-a1", 30_000, 1), claim("a2", agentTurn = true))
    lease.done(ticket, release = true)
    lease.done(granted("a2", agentTurn = true))
    // The lease the line handed over keeps passing.
    lease.done(granted("a2", agentTurn = true))
  }

  @Test fun aHolderThatTookAFreeScreenCannotUseItInAnAgentTurn() {
    lease.done(granted("a1"))
    assertEquals(ScreenLease.Refused, claim("a1", agentTurn = true))
    assertEquals("a1", lease.holderId())
  }

  // Locked agents and their unlock dialogs

  @Test fun aLockedAgentWaitsInLineButGetsNoTicket() {
    assertNull(lease.waitInLine("a2", "name-a2", isAlive))
    assertNull(lease.holderId())
    val ticket = granted("a1")
    assertEquals(ScreenLease.Busy("name-a1", 30_000, 1), lease.waitInLine("a2", "name-a2", isAlive))
    assertEquals(ScreenLease.Refused, lease.waitInLine("a3", "name-a3", isAlive, agentTurn = true))
    assertEquals(listOf("a2"), waiting())
    lease.done(ticket, release = true)
    // Its reservation is not the screen: still no ticket until it claims.
    assertNull(lease.waitInLine("a2", "name-a2", isAlive))
    assertNull(lease.holderId())
  }

  @Test fun anUnlockDialogStopsTheReservationsTime() {
    val ticket = granted("a1")
    busy("a2")
    busy("a3")
    lease.done(ticket, release = true)
    assertNull(lease.promptOpened("a2", "name-a2", isAlive))
    now += 120_000
    lease.tick(isAlive)
    assertEquals(ScreenLease.Busy("name-a2", 30_000, 1), claim("a3"))
    // The 30 s start when the dialog closes.
    lease.promptClosed("a2", keep = true)
    now += 29_999
    lease.tick(isAlive)
    assertEquals(ScreenLease.Seat("a2", "name-a2"), lease.line().holder)
    now += 1
    lease.tick(isAlive)
    assertEquals("yours a3", told.notes.last())
  }

  @Test fun aRefusedOrUnansweredDialogPassesTheScreenOn() {
    val ticket = granted("a1")
    busy("a2")
    busy("a3")
    lease.done(ticket, release = true)
    assertNull(lease.promptOpened("a2", "name-a2", isAlive))
    lease.promptClosed("a2", keep = false)
    assertEquals("yours a3", told.notes.last())
    assertEquals(ScreenLease.Busy("name-a3", 30_000, 1), claim("a2"))
  }

  @Test fun anUnlockDialogStopsTheHoldersIdleTimeButIsNotUse() {
    lease.done(granted("a1"))
    busy("a2")
    assertNull(lease.promptOpened("a1", "name-a1", isAlive))
    now += 60_000
    lease.tick(isAlive)
    assertEquals("a1", lease.holderId())
    assertFalse(lease.inUse())
    lease.promptClosed("a1", keep = true)
    now += 29_999
    lease.tick(isAlive)
    assertEquals("a1", lease.holderId())
    now += 1
    lease.tick(isAlive)
    assertEquals("yours a2", told.notes.last())
  }

  @Test fun aHolderTheUserSaysNoToGivesTheScreenBack() {
    lease.done(granted("a1"))
    assertNull(lease.promptOpened("a1", "name-a1", isAlive))
    lease.promptClosed("a1", keep = false)
    assertNull(lease.holderId())
  }

  @Test fun anUnlockDialogOnAFreeScreenKeepsOthersOff() {
    assertNull(lease.promptOpened("a1", "name-a1", isAlive))
    now += 60_000
    assertEquals(ScreenLease.Busy("name-a1", 30_000, 1), claim("a2"))
    assertEquals("waiting a1 name-a2", told.notes.single())
    lease.promptClosed("a1", keep = true)
    lease.done(granted("a1"), release = true)
    assertEquals("yours a2", told.notes.last())
  }

  @Test fun anUnlockDialogWhileAnotherHasTheScreenWaitsInLine() {
    lease.done(granted("a1"))
    assertEquals(ScreenLease.Busy("name-a1", 30_000, 1), lease.promptOpened("a2", "name-a2", isAlive))
    assertEquals(ScreenLease.Refused, lease.promptOpened("a3", "name-a3", isAlive, agentTurn = true))
    // An agent turn on a free screen may still ask, but holds nothing.
    lease.forget("a1")
    lease.forget("a2")
    assertNull(lease.promptOpened("a3", "name-a3", isAlive, agentTurn = true))
    assertEquals(ScreenLease.Line(null, reserved = false, emptyList()), lease.line())
    lease.done(granted("a4"))
  }
}
