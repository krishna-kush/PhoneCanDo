package com.phonecando.runner.messages.delivery

import com.phonecando.runner.messages.FakeCourier
import com.phonecando.runner.messages.agent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// The mailbox's courier picks the inbox or an ACP prompt per agent, clears
// the folder before a prompt, asks for a switch to ACP mode once, falling
// back to the folder when it never comes or is refused, and asks for a
// stopped agent's start for a set that may wake it.
class RoutingCourierTest {
  private var now = 1_000_000L
  private val b = agent("b", "Tester")
  private val inbox = FakeCourier()
  private val acp = FakeCourier()
  private var look = AcpRoute.Look(
    speaksAcp = true, acpReady = false, acpMode = false, acpBusy = false, terminalReady = true, idle = true, viewer = false,
    jobs = false,
  )
  private var hooks = true
  private var switchTakes = true
  private val switches = ArrayList<String>()
  private var isStopped = false
  private var startTakes = true
  private val starts = ArrayList<String>()
  private val courier = RoutingCourier(
    inbox = inbox,
    acp = acp,
    look = { look },
    folder = { hooks },
    switchToAcp = { switches += it.id; switchTakes },
    clock = { now },
    stopped = { isStopped },
    start = { starts += it.id; startTakes },
  )

  private val waking = Parcel(listOf(1), "wake up", "{}\n", wake = true)
  private val quiet = waking.copy(wake = false)

  @Test fun anIdleAcpAgentGetsItAsAPromptAfterItsFolderIsCleared() {
    look = look.copy(acpReady = true, acpMode = true, terminalReady = false)
    acp.answers["b"] = Handover.WOKE
    assertEquals(Handover.WOKE, courier.handOver(b, waking))
    assertEquals(listOf("b"), inbox.cleared)
    assertEquals(waking, acp.last("b"))
    assertTrue(inbox.handed.isEmpty())
  }

  @Test fun aBusyAcpAgentGetsItThroughItsHooksOrNotAtAll() {
    look = look.copy(acpReady = true, acpMode = true, acpBusy = true, idle = false, terminalReady = false)
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    // Never with the wake mark: only our prompt starts its turn.
    assertEquals(waking.copy(wake = false), inbox.last("b"))
    hooks = false
    assertEquals(Handover.NONE, courier.handOver(b, quiet))
    assertTrue(acp.handed.isEmpty())
  }

  @Test fun anIdleTerminalAgentSwitchesOnceThenTakesItAsAPrompt() {
    assertEquals(Handover.SWITCHING, courier.handOver(b, waking))
    assertEquals(Handover.SWITCHING, courier.handOver(b, waking, retry = true))
    assertEquals(listOf("b"), switches)
    assertTrue(inbox.handed.isEmpty())
    // Its engine starts in ACP mode, and is ready.
    courier.prepare(b)
    look = look.copy(acpReady = true, acpMode = true, terminalReady = false)
    acp.answers["b"] = Handover.WOKE
    assertEquals(Handover.WOKE, courier.handOver(b, waking, retry = true))
  }

  @Test fun aSwitchThatNeverCameLeavesItToTheFolderForAWhile() {
    assertEquals(Handover.SWITCHING, courier.handOver(b, waking))
    now += RoutingCourier.SWITCH_WAIT_MS
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    now += RoutingCourier.SWITCH_HOLD_MS
    assertEquals(Handover.SWITCHING, courier.handOver(b, waking))
    assertEquals(listOf("b", "b"), switches)
  }

  @Test fun aRefusedSwitchLeavesItToTheFolder() {
    switchTakes = false
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    assertEquals(listOf("b"), switches)
  }

  @Test fun aSetThatMayNotWakeOrAWatchedAgentGoesAsToday() {
    assertEquals(Handover.HELD, courier.handOver(b, quiet))
    look = look.copy(viewer = true)
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    // In terminal mode a waiting hook may still take the wake.
    assertEquals(waking, inbox.last("b"))
    assertTrue(switches.isEmpty())
    assertEquals(2, inbox.handed.size)
  }

  @Test fun aWakingSetForAStoppedAgentAsksForItsStart() {
    isStopped = true
    look = look.copy(terminalReady = false, idle = false)
    assertEquals(Handover.STARTING, courier.handOver(b, waking))
    assertEquals(listOf("b"), starts)
    assertTrue(inbox.handed.isEmpty())
    // A set that may not wake it goes to its folder, as today.
    assertEquals(Handover.HELD, courier.handOver(b, quiet))
    assertEquals(listOf("b"), starts)
    assertTrue(switches.isEmpty())
  }

  @Test fun aRetryNeverStartsAStoppedAgent() {
    // Its set was built while it ran; it stopped since.
    isStopped = true
    assertEquals(Handover.HELD, courier.handOver(b, waking, retry = true))
    assertEquals(waking.copy(wake = false), inbox.last("b"))
    assertTrue(starts.isEmpty())
  }

  @Test fun aRefusedStartLeavesTheSetInTheFolderWithoutTheWakeMark() {
    isStopped = true
    startTakes = false
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    assertEquals(waking.copy(wake = false), inbox.last("b"))
  }

  @Test fun anEngineStartingInAcpModeGetsItsFolderWithoutTheWakeMark() {
    look = look.copy(acpMode = true, terminalReady = false)
    assertEquals(Handover.HELD, courier.handOver(b, waking))
    assertEquals(waking.copy(wake = false), inbox.last("b"))
  }
}
