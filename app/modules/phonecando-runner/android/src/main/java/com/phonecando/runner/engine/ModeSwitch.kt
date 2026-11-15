package com.phonecando.runner.engine

// Whether a start in one mode may end an engine that runs in the other
// (one engine per agent, EngineMode). Back to the terminal (you opened
// Home) waits while an ACP turn runs or asks you something: acp_busy, and
// Home keeps showing that turn. Off to ACP (work came while nobody
// watched) never takes the TUI from under you: not while a viewer shows it,
// a run of it is working or waiting for your answer, or it left jobs
// running (engine/work): terminal_in_use. Otherwise the engine stops and
// the start goes on in the wanted mode. Pure.
internal object ModeSwitch {
  /** The engine as it runs now. Each fact counts only in its own [mode]. */
  data class Live(
    val mode: EngineMode,
    /** ACP: a turn runs, or a permission question waits for you. */
    val acpBusy: Boolean = false,
    /** Terminal: a viewer shows the TUI (EngineTerminal.hasViewer). */
    val viewer: Boolean = false,
    /** Terminal: a chat working or waiting for your answer (ChatBoard.busy). */
    val chatBusy: Boolean = false,
    /** Terminal: jobs it left running, or it is kept running (WorkWatch.busyNow). */
    val jobs: Boolean = false,
  )

  sealed interface Decision {
    /** It already runs in that mode: a start only marks it used. */
    object Same : Decision

    /** Stop it, then start in the wanted mode. */
    object Switch : Decision

    data class Refuse(val error: EngineStartError, val detail: String) : Decision
  }

  fun decide(want: EngineMode, live: Live): Decision = when {
    live.mode == want -> Decision.Same
    want == EngineMode.TERMINAL && live.acpBusy ->
      Decision.Refuse(EngineStartError.ACP_BUSY, "it is still working on a task in the background")
    want == EngineMode.ACP && live.viewer -> Decision.Refuse(EngineStartError.TERMINAL_IN_USE, "it is open on screen")
    want == EngineMode.ACP && live.chatBusy -> Decision.Refuse(EngineStartError.TERMINAL_IN_USE, "it is in the middle of a run")
    want == EngineMode.ACP && live.jobs -> Decision.Refuse(EngineStartError.TERMINAL_IN_USE, "it has jobs running")
    else -> Decision.Switch
  }
}
