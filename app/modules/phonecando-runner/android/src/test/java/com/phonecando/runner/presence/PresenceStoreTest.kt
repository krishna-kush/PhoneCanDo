package com.phonecando.runner.presence

import com.phonecando.runner.bridge.ScreenLease
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

// The hand-over's life through the store: what each act does outside
// (the lease frozen and thawed, the note), the waits it
// wakes, a run that ends meanwhile, an engine gone, and the status lines.
class PresenceStoreTest {
  private var now = 100L
  private val fx = FakeEffects()
  private val store = PresenceStore({ now }, fx)
  private val pool = Executors.newCachedThreadPool()

  private fun waitInBackground(agentId: String = "a1", ms: Long = 5_000): Future<PresenceStore.Wait> {
    val started = CountDownLatch(1)
    val f = pool.submit<PresenceStore.Wait> {
      started.countDown()
      store.await(agentId, ms)
    }
    started.await()
    // Let it reach the condition before the act.
    Thread.sleep(50)
    return f
  }

  @Test fun letMeFreezesTheDriversTimeAndGiveBackResumesAnIdleAgent() {
    assertTrue(store.user(UserAct.LET_ME))
    assertEquals(HandOver("a1", "opencode", HandMode.WATCH, HandBy.USER, null, 100), store.handOver())
    assertEquals(listOf("freeze a1"), fx.log)
    assertTrue(store.user(UserAct.GIVE_BACK))
    assertNull(store.handOver())
    assertEquals(listOf("freeze a1", "thaw a1", "resume a1 after watch"), fx.log)
    assertEquals(2, fx.changes)
  }

  @Test fun aWaitingCallGetsBackInsteadOfTheNote() {
    store.user(UserAct.LET_ME)
    val wait = waitInBackground()
    assertTrue(store.user(UserAct.GIVE_BACK))
    assertEquals(PresenceStore.Wait.BACK, wait.get(2, TimeUnit.SECONDS))
    assertEquals(listOf("freeze a1", "thaw a1"), fx.log)
  }

  @Test fun stopEndsAWaitSoTheAgentStopsAndStartAgainSendsItOn() {
    store.user(UserAct.LET_ME)
    val wait = waitInBackground()
    assertTrue(store.user(UserAct.STOP))
    // A real stop: its wait answers at once, and its turn is stopped.
    assertEquals(PresenceStore.Wait.PAUSED, wait.get(2, TimeUnit.SECONDS))
    assertEquals(HandMode.PAUSED, store.handOver()!!.mode)
    // A switch keeps the frozen time: no second freeze.
    assertEquals(listOf("freeze a1", "stop a1"), fx.log)
    assertFalse(store.user(UserAct.GIVE_BACK))
    assertTrue(store.user(UserAct.START_AGAIN))
    assertEquals(listOf("freeze a1", "stop a1", "thaw a1", "resume a1 after paused"), fx.log)
  }

  @Test fun stopStopsItsTurnAndAgainWhenItCallsTheScreenRegardless() {
    store.user(UserAct.STOP)
    // At once, where its kind can.
    assertEquals(listOf("freeze a1", "stop a1"), fx.log)
    // The first refusal is how a kind that can't be stopped hears of it.
    store.pausedCall("a1")
    assertEquals(listOf("freeze a1", "stop a1"), fx.log)
    store.pausedCall("a1")
    assertEquals(listOf("freeze a1", "stop a1", "stop a1"), fx.log)
    // Another agent's calls, or calls with no Stop on, count for nothing.
    store.pausedCall("a2")
    store.user(UserAct.START_AGAIN)
    store.pausedCall("a1")
    assertEquals(listOf("freeze a1", "stop a1", "stop a1", "thaw a1", "resume a1 after paused"), fx.log)
  }

  @Test fun startAgainSendsTheNoteToAnAgentNotWaiting() {
    store.user(UserAct.STOP)
    assertTrue(store.user(UserAct.START_AGAIN))
    assertEquals(listOf("freeze a1", "stop a1", "thaw a1", "resume a1 after paused"), fx.log)
  }

  @Test fun leaveKeepsItStoppedAndGivesTheScreenBackIfItsRunEnded() {
    store.user(UserAct.STOP)
    // Its run ended while you drove: the lease keeps the screen for it.
    assertTrue(store.runEnded("a1"))
    assertFalse(store.runEnded("a2"))
    assertTrue(store.user(UserAct.LEAVE))
    assertEquals(listOf("freeze a1", "stop a1", "thaw a1, give back"), fx.log)
  }

  @Test fun leaveWhileItsRunGoesOnKeepsItOffTheScreenUntilThatRunEnds() {
    store.user(UserAct.STOP)
    assertTrue(store.user(UserAct.LEAVE))
    // The screen goes now, and its turn is stopped where its kind can.
    assertNull(store.handOver())
    assertEquals(listOf("freeze a1", "stop a1", "thaw a1, give back", "stop a1"), fx.log)
    assertTrue(store.leftStopped("a1"))
    assertFalse(store.leftStopped("a2"))
    // Still calling the screen: each call stops its turn again; no hand-over of its own.
    store.pausedCall("a1")
    assertEquals("stop a1", fx.log.last())
    assertNull(store.agent("a1", "opencode", "x", private = false))
    // Its run ended: the bridge gives the screen back as for any run, and its next run drives.
    assertFalse(store.runEnded("a1"))
    assertFalse(store.leftStopped("a1"))
  }

  @Test fun aResumeKeepsTheScreenForTheRunToCome() {
    store.user(UserAct.STOP)
    store.runEnded("a1")
    store.user(UserAct.START_AGAIN)
    assertEquals("thaw a1", fx.log[2])
  }

  @Test fun nothingToDoWithNobodyAtTheScreen() {
    fx.target = null
    assertFalse(store.user(UserAct.LET_ME))
    assertFalse(store.user(UserAct.STOP))
    assertFalse(store.user(UserAct.LEAVE))
    assertTrue(fx.log.isEmpty())
    assertEquals(0, fx.changes)
  }

  @Test fun anAgentsOwnPrivateHandOverLeavesItsTurnAlone() {
    // It asked for the pause and waits in it: nothing to stop.
    store.agent("a1", "opencode", "type your password", private = true)
    assertEquals(listOf("freeze a1"), fx.log)
  }

  @Test fun anAgentHandsOverOncePerPhone() {
    val watch = store.agent("a2", "claude", "pick a photo", private = false)!!
    assertEquals(HandOver("a2", "claude", HandMode.WATCH, HandBy.AGENT, "pick a photo", 100), watch)
    assertNull(store.agent("a3", "gemini", "x", private = true))
    assertFalse(store.user(UserAct.LET_ME))
    assertEquals(listOf("freeze a2"), fx.log)
  }

  @Test fun waitsEndInTime() {
    assertEquals(PresenceStore.Wait.BACK, store.await("a1", 10))
    store.agent("a1", "opencode", "why", private = false)
    assertEquals(PresenceStore.Wait.WATCH, store.await("a1", 30))
    assertEquals(PresenceStore.Wait.BACK, store.await("a2", 30_000))
    store.user(UserAct.STOP)
    assertEquals(PresenceStore.Wait.PAUSED, store.await("a1", 30))
  }

  @Test fun anEngineGoneEndsItsHandOverWithNoNote() {
    store.agent("a1", "opencode", "why", private = false)
    val wait = waitInBackground()
    store.forget("a2")
    store.forget("a1")
    assertNull(store.handOver())
    assertEquals(PresenceStore.Wait.BACK, wait.get(2, TimeUnit.SECONDS))
    assertEquals(listOf("freeze a1", "thaw a1"), fx.log)
  }

  @Test fun statusesSetClearAndGo() {
    store.status("a1", "Reading the logs", StatusMood.WORKING)
    store.status("a1", "Reading the logs", StatusMood.WORKING)
    assertEquals(1, fx.changes)
    assertEquals(AgentStatus("Reading the logs", StatusMood.WORKING, 100), store.statuses()["a1"])
    store.status("a1", " ", StatusMood.WORKING)
    assertNull(store.statuses()["a1"])
    assertEquals(2, fx.changes)
    // At run end, with the engine, and stale.
    store.status("a1", "x", StatusMood.THINKING)
    store.status("a2", "y", StatusMood.WAITING)
    store.status("a3", "z", StatusMood.WORKING)
    store.runEnded("a1")
    store.forget("a2")
    assertEquals(setOf("a3"), store.statuses().keys)
    now += StatusRules.STALE_MS
    store.tick()
    assertTrue(store.statuses().isEmpty())
  }

  @Test fun theFrameIsTheDriverTheHandOverAndTheLines() {
    store.status("a2", "Testing", StatusMood.WORKING)
    store.user(UserAct.LET_ME)
    val driver = ScreenLease.Seat("a1", "opencode")
    val frame = store.frame(driver)
    assertEquals(driver, frame.driver)
    assertEquals("a1", frame.handOver!!.agentId)
    assertEquals(setOf("a2"), frame.statuses.keys)
    store.clear()
    assertEquals(PresenceFrame.EMPTY, store.frame(null))
  }
}
