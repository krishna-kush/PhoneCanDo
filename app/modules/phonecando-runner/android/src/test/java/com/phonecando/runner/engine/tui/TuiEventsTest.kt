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
        // A title the pattern rejects: no chat title now, so the last one goes.
        title(""),
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

  @Test fun aWorkingRunYouTypedIntoThatShowsNothingIsStopped() {
    var now = 1_000L
    val events = TuiEvents(rules, null, null, { now }) { seen += it }
    events.quiet(null, null) // not working: nothing to stop
    events.raise(Kind.WORKING)
    val typed = now + 1_000L // an Esc
    now += TuiEvents.QUIET_MS - 1
    events.quiet(500L, typed)
    // Output since the run began counts from then.
    now += 10_000L
    events.quiet(now - 1_000L, typed)
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION)), seen)
    now += TuiEvents.QUIET_MS
    events.quiet(now - TuiEvents.QUIET_MS, typed)
    events.quiet(now - TuiEvents.QUIET_MS, typed)
    // Stopped by a guess, so what must not guess (the checks) can skip it.
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION), EngineEvent(Kind.STOPPED, TuiEvents.SESSION, guessed = true)), seen)
    // A run that finished stays finished.
    seen.clear()
    events.raise(Kind.FINISHED)
    now += 10 * TuiEvents.QUIET_MS
    events.quiet(null, now)
    assertEquals(listOf(EngineEvent(Kind.FINISHED, TuiEvents.SESSION)), seen)
  }

  @Test fun withoutTypingOnlyALongQuietStopsIt() {
    var now = 1_000L
    val events = TuiEvents(rules, null, null, { now }) { seen += it }
    // Typing before the run began (its prompt) does not count.
    val prompt = now - 500L
    events.raise(Kind.WORKING)
    // Nobody looks: the TUI may show nothing while a slow model works.
    now += 10 * TuiEvents.QUIET_MS
    events.quiet(null, prompt)
    events.quiet(null, null)
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION)), seen)
    // A hook that never fired: past QUIET_MAX_MS of nothing it ends.
    now = 1_000L + TuiEvents.QUIET_MAX_MS
    events.quiet(null, prompt)
    assertEquals(listOf(EngineEvent(Kind.WORKING, TuiEvents.SESSION), EngineEvent(Kind.STOPPED, TuiEvents.SESSION, guessed = true)), seen)
  }

  @Test fun aRejectedTitleClearsTheLastOnce() {
    val events = TuiEvents(rules, Regex("^\\S (?!Claude Code$)(.+)$"), "✳ Old chat") { seen += it }
    events.raise(Kind.FINISHED)
    // A fresh chat: the TUI shows its own name, twice.
    events.onSignals(listOf(Signal.Title("✳ Claude Code"), Signal.Title("✳ Claude Code")))
    events.raise(Kind.WORKING)
    events.onSignals(listOf(Signal.Title("✳ New chat")))
    assertEquals(
      listOf(
        EngineEvent(Kind.FINISHED, TuiEvents.SESSION),
        title("Old chat"),
        title(""),
        EngineEvent(Kind.WORKING, TuiEvents.SESSION),
        title("New chat"),
      ),
      seen,
    )
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
