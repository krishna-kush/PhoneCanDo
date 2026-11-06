package com.phonecando.runner.agents

/**
 * One event from an engine's stream, in terms every kind maps onto
 * (AgentKind.parseEvent). `sessionCreated` is true for a new top-level
 * session; its kind stays OTHER, so the watch logic ignores it.
 */
data class EngineEvent(
  val kind: Kind,
  val sessionId: String?,
  val sessionCreated: Boolean = false,
) {
  enum class Kind {
    /** Generation activity: step/text/part/message movement. */
    WORKING,

    /** The run ended cleanly. */
    FINISHED,

    /** The run failed. */
    FAILED,

    /** Session deleted elsewhere. */
    GONE,

    /** Anything else (connection, catalog, TUI toasts…). */
    OTHER,
  }
}
