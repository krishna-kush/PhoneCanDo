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
  /**
   * Why it failed or died; for a stopped engine only why we stopped it
   * ourselves (the memory guard: MemoryRules.STOPPED_REASON; a service
   * time limit: PhoneCanDoServeService.TIME_LIMIT_REASON), else null.
   */
  val error: String?,
  /** Epoch ms of the last start, engine event, bridge call or touch. */
  val lastUsedAt: Long?,
  /** The mode it runs in, or last ran in (EngineMode). */
  val mode: EngineMode = EngineMode.TERMINAL,
  /** An ACP turn is running (engine/acp/); always false in terminal mode. */
  val busy: Boolean = false,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "agentId" to agentId,
    "state" to state.wire,
    "port" to port,
    "error" to error,
    "lastUsedAt" to lastUsedAt?.toDouble(),
    "mode" to mode.wire,
    "busy" to busy,
  )
}

/** Typed reasons a start is refused; [code] is what JS matches (records.ts EngineStartError). */
enum class EngineStartError(val code: String) {
  /** The user's cap on running agents (RunLimits.maxAgents) is reached and none has been idle a minute. */
  TOO_MANY_RUNNING("too_many_running"),

  /** The agent's model is not loaded and the user's cap on loaded models (RunLimits.maxModels) is reached. */
  TOO_MANY_MODELS("too_many_models"),
  IMAGE_NOT_READY("image_not_ready"),
  ENGINE_MISSING("engine_missing"),
  PORT_UNAVAILABLE("port_unavailable"),
  START_FAILED("start_failed"),

  /** The kind installs into the agent's image, and no install of it is recorded yet. */
  AGENT_NOT_INSTALLED("agent_not_installed"),

  /**
   * The agent's local model cannot serve it: gone from the phone, too big
   * for its RAM, a phone or kind that cannot use one, still loading for
   * another agent, or a server that never answered ready. The detail says
   * which, fit for the UI.
   */
  MODEL_UNAVAILABLE("model_unavailable"),

  /** A start in terminal mode while the agent's ACP turn runs or asks you something (ModeSwitch). */
  ACP_BUSY("acp_busy"),

  /** A start in ACP mode while its TUI is on screen, in a run or has jobs running (ModeSwitch). */
  TERMINAL_IN_USE("terminal_in_use"),
}

/** A refused start: the message starts with the code, so JS can read it from either. */
class EngineStartException(val error: EngineStartError, detail: String) : Exception("${error.code}: $detail")
