package com.phonecando.runner.messages.delivery

import com.phonecando.runner.messages.delivery.AcpRoute.Look
import com.phonecando.runner.messages.delivery.AcpRoute.Way
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Every row of the way a set goes for a kind with an ACP mode.
class AcpRouteTest {
  // Idle in ACP mode.
  private val acpIdle = Look(
    speaksAcp = true, acpReady = true, acpMode = true, acpBusy = false, terminalReady = false, idle = true, viewer = false,
    jobs = false,
  )

  // Idle in terminal mode, nobody watching.
  private val terminalIdle = acpIdle.copy(acpReady = false, acpMode = false, terminalReady = true)

  @Test fun anIdleAcpAgentGetsAWakingSetAsAPrompt() {
    assertEquals(Way.PROMPT, AcpRoute.decide(acpIdle, wake = true, folder = true))
    assertEquals(Way.PROMPT, AcpRoute.decide(acpIdle, wake = true, folder = false))
  }

  @Test fun aBusyAcpAgentOrASetThatMayNotWakeGoesToItsHooksElseWaits() {
    val busy = acpIdle.copy(acpBusy = true, idle = false)
    assertEquals(Way.INBOX, AcpRoute.decide(busy, wake = true, folder = true))
    assertEquals(Way.NONE, AcpRoute.decide(busy, wake = true, folder = false))
    assertEquals(Way.INBOX, AcpRoute.decide(acpIdle, wake = false, folder = true))
    assertEquals(Way.NONE, AcpRoute.decide(acpIdle, wake = false, folder = false))
  }

  @Test fun anIdleTerminalAgentNobodyWatchesSwitchesForAWakingSet() {
    assertEquals(Way.SWITCH, AcpRoute.decide(terminalIdle, wake = true, folder = true))
    assertEquals(Way.SWITCH, AcpRoute.decide(terminalIdle, wake = true, folder = false))
    // Not waking: its folder, as today.
    assertEquals(Way.INBOX, AcpRoute.decide(terminalIdle, wake = false, folder = true))
  }

  @Test fun aWatchedBusyOrWorkingTerminalAgentStaysInTerminalMode() {
    for (look in listOf(terminalIdle.copy(viewer = true), terminalIdle.copy(jobs = true), terminalIdle.copy(idle = false))) {
      assertEquals(Way.INBOX, AcpRoute.decide(look, wake = true, folder = true))
      assertFalse(look.canSwitch)
    }
    // Starting, stopping or stopped: the folder, as today.
    assertEquals(Way.INBOX, AcpRoute.decide(terminalIdle.copy(terminalReady = false), wake = true, folder = true))
  }

  @Test fun aKindWithoutAnAcpModeAlwaysGoesAsToday() {
    assertEquals(Way.INBOX, AcpRoute.decide(Look.NONE, wake = true, folder = true))
    assertEquals(Way.INBOX, AcpRoute.decide(Look.NONE.copy(terminalReady = true, idle = true), wake = true, folder = false))
    assertFalse(AcpRoute.readyToWake(Look.NONE.copy(terminalReady = true, idle = true)))
  }

  @Test fun theFolderNeverGetsTheWakeMarkInAcpMode() {
    assertFalse(AcpRoute.folderWake(acpIdle, wake = true))
    assertFalse(AcpRoute.folderWake(terminalIdle.copy(acpMode = true, terminalReady = false), wake = true))
    assertTrue(AcpRoute.folderWake(terminalIdle, wake = true))
    assertTrue(AcpRoute.folderWake(Look.NONE, wake = true))
    assertFalse(AcpRoute.folderWake(Look.NONE, wake = false))
  }

  @Test fun readyToWakeWhenIdleInAcpModeOrFreeToSwitch() {
    assertTrue(AcpRoute.readyToWake(acpIdle))
    assertTrue(AcpRoute.readyToWake(terminalIdle))
    assertFalse(AcpRoute.readyToWake(acpIdle.copy(acpBusy = true)))
    assertFalse(AcpRoute.readyToWake(terminalIdle.copy(viewer = true)))
    assertFalse(AcpRoute.readyToWake(terminalIdle.copy(terminalReady = false)))
  }
}
