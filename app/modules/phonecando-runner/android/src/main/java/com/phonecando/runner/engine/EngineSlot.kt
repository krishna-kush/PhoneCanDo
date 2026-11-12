package com.phonecando.runner.engine

import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.tui.EngineTerminal

// One agent's engine as the supervisor holds it. Every field except
// lastUsedAt and lastEventAt changes only under the supervisor's lock; state
// and terminal are volatile so they can be read without it. `gen` grows
// with every start and stop: a launch or a callback that finds another
// generation than the one it began with lost a race and backs out.
internal class EngineSlot(val agentId: String) {
  @Volatile var state = EngineState.STOPPED
  var gen = 0

  /** A server engine's port; a TUI engine has none. */
  var port: Int? = null
  var error: String? = null

  /** Epoch ms; written without the lock (bridge calls, engine events, touches). */
  @Volatile var lastUsedAt: Long? = null

  /** Epoch ms of this engine life's last activity event (EngineStreams); null since its start. Idle reads it. */
  @Volatile var lastEventAt: Long? = null

  /** Epoch ms of this engine life's first activity event; null since its start. Job detection reads it (engine/work/). */
  @Volatile var firstEventAt: Long? = null

  /** The launched process; null until it runs, and while a server engine moves to a fresh port. */
  var process: EngineProcess? = null
  var watch: EngineWatch? = null
  var events: EventSource? = null

  /** What the running process was launched with; volatile, as the bridge reads its kind without the lock. */
  @Volatile var plan: LaunchPlan? = null

  /** A TUI engine's terminal, which viewers attach to; null for a server engine. */
  @Volatile var terminal: EngineTerminal? = null

  /** Relaunches on a fresh port after a 401 during this start (EngineWatch). */
  var squatRelaunches = 0

  /** When it was last used: lastUsedAt, or a TUI's last output when its kind counts output as activity. */
  fun usedAt(): Long? {
    val output = terminal?.takeIf { plan?.kind?.watchesOutput == true }?.lastOutputAt
    return listOfNotNull(lastUsedAt, output).maxOrNull()
  }

  fun status() = EngineStatus(
    agentId = agentId,
    state = state,
    port = port?.takeIf { state == EngineState.STARTING || state == EngineState.READY }?.toString(),
    error = error,
    lastUsedAt = usedAt(),
  )
}
