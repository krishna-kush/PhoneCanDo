package com.phonecando.runner.engine.acp

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.engine.tui.TuiEvents

// An ACP turn's course as engine events (EngineStreams: activity, alerts,
// the chat board, a run's end), on the agent's one chat as a TUI has it
// (TuiEvents.SESSION), so Home and the notification read it the same in
// either mode: a prompt sent is working, a permission question waiting,
// its answer working again; the turn's end by its stop reason: end_turn
// finished, cancelled stopped, refusal, max_tokens and max_turn_requests
// failed, as is an error answer (or the agent gone). A stop reason we do
// not know ended the turn without saying it failed: finished. Pure.
internal object AcpEvents {
  fun promptSent(): EngineEvent = event(EngineEvent.Kind.WORKING)

  fun asked(): EngineEvent = event(EngineEvent.Kind.WAITING)

  fun answered(): EngineEvent = event(EngineEvent.Kind.WORKING)

  fun ended(stopReason: String?, error: String?): EngineEvent = event(kindOf(stopReason, error))

  /** The chat's title (a new chat's, or one the agent sent). */
  fun title(title: String): EngineEvent = EngineEvent(EngineEvent.Kind.OTHER, TuiEvents.SESSION, title = title)

  fun kindOf(stopReason: String?, error: String?): EngineEvent.Kind = when {
    error != null -> EngineEvent.Kind.FAILED
    stopReason == CANCELLED -> EngineEvent.Kind.STOPPED
    stopReason != null && stopReason in FAILURES -> EngineEvent.Kind.FAILED
    else -> EngineEvent.Kind.FINISHED
  }

  private fun event(kind: EngineEvent.Kind) = EngineEvent(kind, TuiEvents.SESSION)

  private const val CANCELLED = "cancelled"
  private val FAILURES = setOf("refusal", "max_tokens", "max_turn_requests")
}
