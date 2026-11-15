package com.phonecando.runner.engine

/**
 * How an agent's engine runs; [wire] is the name JS sees (records.ts
 * EngineStatus.mode, startEngine's mode) and the start intent's EXTRA_MODE.
 */
enum class EngineMode(val wire: String) {
  /** As the kind runs it on Home: its TUI on our PTY, or its server. */
  TERMINAL("terminal"),

  /** The same agent speaking ACP on pipes, with no screen (a kind with `engine.acp`): work that comes while nobody watches. */
  ACP("acp"),
  ;

  companion object {
    /** Null or empty: TERMINAL; a name we do not know: null. */
    fun of(wire: String?): EngineMode? = if (wire.isNullOrEmpty()) TERMINAL else values().firstOrNull { it.wire == wire }
  }
}
