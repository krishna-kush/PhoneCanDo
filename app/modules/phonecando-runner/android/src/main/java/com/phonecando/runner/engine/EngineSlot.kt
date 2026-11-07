package com.phonecando.runner.engine

// One agent's engine as the supervisor holds it. Every field except
// lastUsedAt changes only under the supervisor's lock; state is volatile so
// "is anything running" can be read without it. `gen` grows with every
// start and stop: a launch or a callback that finds another generation
// than the one it began with lost a race and backs out.
internal class EngineSlot(val agentId: String) {
  @Volatile var state = EngineState.STOPPED
  var gen = 0
  var port: Int? = null
  var error: String? = null

  /** Epoch ms; written without the lock (bridge calls, engine events, touches). */
  @Volatile var lastUsedAt: Long? = null
  var process: Process? = null
  var watch: EngineWatch? = null
  var sse: SseClient? = null
  var plan: LaunchPlan? = null

  /** Relaunches on a fresh port after a 401 during this start (EngineWatch). */
  var squatRelaunches = 0

  fun status() = EngineStatus(
    agentId = agentId,
    state = state,
    port = port?.takeIf { state == EngineState.STARTING || state == EngineState.READY }?.toString(),
    error = error,
    lastUsedAt = lastUsedAt,
  )
}
