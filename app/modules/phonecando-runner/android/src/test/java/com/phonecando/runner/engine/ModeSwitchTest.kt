package com.phonecando.runner.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the mode switch: the same mode is a plain start, back to
// the terminal waits for a busy ACP turn, off to ACP never takes a TUI in
// use, and each fact counts only in its own mode.
class ModeSwitchTest {
  private fun refused(decision: ModeSwitch.Decision): EngineStartError? = (decision as? ModeSwitch.Decision.Refuse)?.error

  @Test fun theSameModeIsAPlainStart() {
    assertEquals(ModeSwitch.Decision.Same, ModeSwitch.decide(EngineMode.ACP, ModeSwitch.Live(EngineMode.ACP, acpBusy = true)))
    assertEquals(ModeSwitch.Decision.Same, ModeSwitch.decide(EngineMode.TERMINAL, ModeSwitch.Live(EngineMode.TERMINAL, viewer = true)))
  }

  @Test fun backToTheTerminalWaitsForABusyTurn() {
    val busy = ModeSwitch.decide(EngineMode.TERMINAL, ModeSwitch.Live(EngineMode.ACP, acpBusy = true))
    assertEquals(EngineStartError.ACP_BUSY, refused(busy))
    assertEquals(ModeSwitch.Decision.Switch, ModeSwitch.decide(EngineMode.TERMINAL, ModeSwitch.Live(EngineMode.ACP)))
  }

  @Test fun offToAcpNeverTakesATuiInUse() {
    for (live in listOf(
      ModeSwitch.Live(EngineMode.TERMINAL, viewer = true),
      ModeSwitch.Live(EngineMode.TERMINAL, chatBusy = true),
      ModeSwitch.Live(EngineMode.TERMINAL, jobs = true),
    )) {
      assertEquals(EngineStartError.TERMINAL_IN_USE, refused(ModeSwitch.decide(EngineMode.ACP, live)))
    }
    assertEquals(ModeSwitch.Decision.Switch, ModeSwitch.decide(EngineMode.ACP, ModeSwitch.Live(EngineMode.TERMINAL)))
  }

  @Test fun factsOfTheOtherModeDoNotCount() {
    // A busy flag left on a terminal engine does not hold a switch to ACP.
    assertEquals(ModeSwitch.Decision.Switch, ModeSwitch.decide(EngineMode.ACP, ModeSwitch.Live(EngineMode.TERMINAL, acpBusy = true)))
    // Nor does a viewer on an ACP engine hold one back to the terminal.
    assertEquals(ModeSwitch.Decision.Switch, ModeSwitch.decide(EngineMode.TERMINAL, ModeSwitch.Live(EngineMode.ACP, viewer = true, jobs = true)))
  }

  @Test fun theRefusalSaysWhyInItsMessage() {
    val refusal = ModeSwitch.decide(EngineMode.ACP, ModeSwitch.Live(EngineMode.TERMINAL, viewer = true)) as ModeSwitch.Decision.Refuse
    val e = EngineStartException(refusal.error, refusal.detail)
    assertEquals("terminal_in_use: it is open on screen", e.message)
  }

  @Test fun modesReadFromTheWire() {
    assertEquals(EngineMode.TERMINAL, EngineMode.of(null))
    assertEquals(EngineMode.TERMINAL, EngineMode.of(""))
    assertEquals(EngineMode.TERMINAL, EngineMode.of("terminal"))
    assertEquals(EngineMode.ACP, EngineMode.of("acp"))
    assertNull(EngineMode.of("ACP"))
  }

  @Test fun theStatusCarriesItsModeAndBusy() {
    val map = EngineStatus("a1", EngineState.READY, null, null, null, EngineMode.ACP, busy = true).toMap()
    assertEquals("acp", map["mode"])
    assertEquals(true, map["busy"])
    assertEquals("terminal", EngineStatus("a1", EngineState.STOPPED, null, null, null).toMap()["mode"])
  }
}
