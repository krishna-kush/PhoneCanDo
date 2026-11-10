package com.phonecando.agents.kit.term

import com.phonecando.agents.kit.EngineEvent.Kind
import com.phonecando.agents.kit.manifest.PtyEvent
import com.phonecando.agents.kit.manifest.PtyRule
import com.phonecando.agents.kit.manifest.PtySignal
import org.junit.jupiter.api.Test
import java.util.regex.PatternSyntaxException
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

// JVM checks for SignalRules: the first rule that fits wins, `match` is
// searched in the signal's text, and signals no rule can name raise nothing.
class SignalRulesTest {
  private val rules = SignalRules(
    listOf(
      PtyRule(PtySignal.BEL, null, PtyEvent.WAITING),
      PtyRule(PtySignal.OSC9, "^Approval requested", PtyEvent.WAITING),
      PtyRule(PtySignal.OSC9, null, PtyEvent.FINISHED),
      PtyRule(PtySignal.OSC777, "fail", PtyEvent.FAILED),
      PtyRule(PtySignal.PROGRESS, "^[13];", PtyEvent.WORKING),
      PtyRule(PtySignal.OSC7501, "^state=blocked", PtyEvent.WAITING),
      PtyRule(PtySignal.OSC7501, "^state=done(?!:id=)", PtyEvent.FINISHED),
      PtyRule(PtySignal.OSC7501, "^state=idle(?!:id=)", PtyEvent.STOPPED),
    ),
  )

  @Test fun theFirstFittingRuleWins() {
    assertEquals(Kind.WAITING, rules.eventFor(Signal.Bell))
    assertEquals(Kind.WAITING, rules.eventFor(Signal.Osc9("Approval requested: rm -rf")))
    assertEquals(Kind.FINISHED, rules.eventFor(Signal.Osc9("Task done")))
    assertEquals(Kind.FAILED, rules.eventFor(Signal.Osc777("Build;it did fail")))
    assertNull(rules.eventFor(Signal.Osc777("Build;ok")))
    assertEquals(Kind.WORKING, rules.eventFor(Signal.Progress("1;40")))
    assertNull(rules.eventFor(Signal.Progress("0;0")))
    assertEquals(Kind.WAITING, rules.eventFor(Signal.Status("state=blocked:id=worker:kind=permission")))
    assertEquals(Kind.FINISHED, rules.eventFor(Signal.Status("state=done:app=x")))
    // A child record's text has its id right after the state.
    assertNull(rules.eventFor(Signal.Status("state=done:id=worker")))
    assertEquals(Kind.STOPPED, rules.eventFor(Signal.Status("state=idle:app=x")))
    assertNull(rules.eventFor(Signal.Status("state=clear")))
  }

  @Test fun signalsNoRuleCanName() {
    for (s in listOf(Signal.Title("x"), Signal.FullClear, Signal.Reset, Signal.AltScreen(true), Signal.Modes(listOf(25), true), Signal.StatusQuery(true))) {
      assertNull(rules.eventFor(s))
    }
    assertNull(SignalRules(emptyList()).eventFor(Signal.Bell))
  }

  @Test fun aBadMatchThrows() {
    assertFailsWith<PatternSyntaxException> { SignalRules(listOf(PtyRule(PtySignal.BEL, "(", PtyEvent.WAITING))) }
  }
}
