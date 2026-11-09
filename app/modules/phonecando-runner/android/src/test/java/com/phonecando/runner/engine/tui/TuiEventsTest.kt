package com.phonecando.runner.engine.tui

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.EngineEvent.Kind
import com.phonecando.agents.kit.manifest.PtyEvent
import com.phonecando.agents.kit.manifest.PtyRule
import com.phonecando.agents.kit.manifest.PtySignal
import com.phonecando.agents.kit.term.Signal
import com.phonecando.agents.kit.term.SignalRules
import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for TuiEvents: rule events for the TUI's one chat, and its
// title from the window title, also after each rule event.
class TuiEventsTest {
  private val rules = SignalRules(listOf(PtyRule(PtySignal.BEL, null, PtyEvent.WAITING), PtyRule(PtySignal.OSC777, null, PtyEvent.FINISHED)))
  private val seen = ArrayList<EngineEvent>()

  private fun title(t: String) = EngineEvent(Kind.OTHER, TuiEvents.SESSION, title = t)

  @Test fun rulesAndTitles() {
    val events = TuiEvents(rules, Regex("^OC \\| (.+)$"), "OC | Fix login") { seen += it }
    events.onSignals(listOf(Signal.Bell, Signal.Title("shell"), Signal.Title("OC | Tests"), Signal.FullClear, Signal.Osc777("done;ok")))
    assertEquals(
      listOf(
        EngineEvent(Kind.WAITING, TuiEvents.SESSION),
        title("Fix login"),
        title("Tests"),
        EngineEvent(Kind.FINISHED, TuiEvents.SESSION),
        title("Tests"),
      ),
      seen,
    )
  }

  @Test fun eventsFileEventsJoinTheSameChat() {
    val events = TuiEvents(rules, Regex("^OC \\| (.+)$"), null) { seen += it }
    events.raise(Kind.WORKING)
    events.onSignals(listOf(Signal.Title("OC | Tests")))
    events.raise(Kind.FINISHED)
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION), title("Tests"), EngineEvent(Kind.FINISHED, TuiEvents.SESSION), title("Tests")), seen)
  }

  @Test fun aWorkingRunThatShowsNothingIsStopped() {
    var now = 1_000L
    val events = TuiEvents(rules, null, null, { now }) { seen += it }
    events.quiet(null) // not working: nothing to stop
    events.raise(Kind.WORKING)
    now += TuiEvents.QUIET_MS - 1
    events.quiet(500L)
    // Output since the run began counts from then.
    now += 10_000L
    events.quiet(now - 1_000L)
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION)), seen)
    now += TuiEvents.QUIET_MS
    events.quiet(now - TuiEvents.QUIET_MS)
    events.quiet(now - TuiEvents.QUIET_MS)
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION), EngineEvent(Kind.STOPPED, TuiEvents.SESSION)), seen)
    // A run that finished stays finished.
    seen.clear()
    events.raise(Kind.FINISHED)
    now += 10 * TuiEvents.QUIET_MS
    events.quiet(null)
    assertEquals(listOf(EngineEvent(Kind.FINISHED, TuiEvents.SESSION)), seen)
  }

  @Test fun noPatternNoTitle() {
    val events = TuiEvents(rules, null, "anything") { seen += it }
    events.onSignals(listOf(Signal.Title("x"), Signal.Bell))
    assertEquals(listOf(EngineEvent(Kind.WAITING, TuiEvents.SESSION)), seen)
    seen.clear()
    // A pattern without a group names no title.
    TuiEvents(rules, Regex("x"), null) { seen += it }.onSignals(listOf(Signal.Title("x")))
    assertEquals(emptyList<EngineEvent>(), seen)
  }
}
