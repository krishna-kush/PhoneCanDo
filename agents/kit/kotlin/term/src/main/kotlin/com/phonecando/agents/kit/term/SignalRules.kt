package com.phonecando.agents.kit.term

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.manifest.PtyEvent
import com.phonecando.agents.kit.manifest.PtyRule
import com.phonecando.agents.kit.manifest.PtySignal

// A kind's `events[].pty.rules` over the Signals in its TUI's output: the
// first rule whose signal it is and whose `match` (a regex, searched in the
// signal's text; a bell has none) fits names the engine event. Signals no
// rule names (titles, clears, modes) raise nothing. Throws
// PatternSyntaxException for a bad `match`. Pure.
class SignalRules(rules: List<PtyRule>) {
  private class Rule(val on: PtySignal, val match: Regex?, val kind: EngineEvent.Kind)

  private val rules = rules.map { Rule(it.on, it.match?.let(::Regex), kindOf(it.event)) }

  /** The event kind [signal] raises, or null. */
  fun eventFor(signal: Signal): EngineEvent.Kind? {
    val (on, text) = when (signal) {
      Signal.Bell -> PtySignal.BEL to ""
      is Signal.Osc9 -> PtySignal.OSC9 to signal.text
      is Signal.Osc777 -> PtySignal.OSC777 to signal.text
      is Signal.Progress -> PtySignal.PROGRESS to signal.text
      else -> return null
    }
    return rules.firstOrNull { it.on == on && (it.match == null || it.match.containsMatchIn(text)) }?.kind
  }

  private fun kindOf(event: PtyEvent) = when (event) {
    PtyEvent.WORKING -> EngineEvent.Kind.WORKING
    PtyEvent.WAITING -> EngineEvent.Kind.WAITING
    PtyEvent.FINISHED -> EngineEvent.Kind.FINISHED
    PtyEvent.FAILED -> EngineEvent.Kind.FAILED
  }
}
