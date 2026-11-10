package com.phonecando.runner.engine

/** Where one agent's engine is; [wire] is the name JS sees (records.ts EngineState). */
enum class EngineState(val wire: String) {
  STOPPED("stopped"),
  STARTING("starting"),
  READY("ready"),
  STOPPING("stopping"),

  /** Exited without a stop request; the next start relaunches it. */
  DIED("died"),

  /** The last start failed; [EngineStatus.error] says why. */
  FAILED("failed"),
  ;

  /** A process may exist: counts for the bridge and the service. */
  val live: Boolean get() = this == STARTING || this == READY || this == STOPPING
}

/** One engine as JS sees it (engineStatus, the phonecandoEngineState event). */
data class EngineStatus(
  val agentId: String,
  val state: EngineState,
  /** The loopback port while starting or ready. */
  val port: String?,
  val error: String?,
  /** Epoch ms of the last start, engine event, bridge call or touch. */
  val lastUsedAt: Long?,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "agentId" to agentId,
    "state" to state.wire,
    "port" to port,
    "error" to error,
    "lastUsedAt" to lastUsedAt?.toDouble(),
  )
}

/** Typed reasons a start is refused; [code] is what JS matches (records.ts EngineStartError). */
enum class EngineStartError(val code: String) {
  TOO_MANY_RUNNING("too_many_running"),
  IMAGE_NOT_READY("image_not_ready"),
  ENGINE_MISSING("engine_missing"),
  PORT_UNAVAILABLE("port_unavailable"),
  START_FAILED("start_failed"),

  /** The kind installs into the agent's image, and no install of it is recorded yet. */
  AGENT_NOT_INSTALLED("agent_not_installed"),

  /**
   * The agent's local model cannot serve it: gone from the phone, too big
   * for its RAM, a phone or kind that cannot use one, another model loaded
   * for a running agent, or a server that never answered ready. The detail
   * says which, fit for the UI.
   */
  MODEL_UNAVAILABLE("model_unavailable"),
}

/** A refused start: the message starts with the code, so JS can read it from either. */
class EngineStartException(val error: EngineStartError, detail: String) : Exception("${error.code}: $detail")
