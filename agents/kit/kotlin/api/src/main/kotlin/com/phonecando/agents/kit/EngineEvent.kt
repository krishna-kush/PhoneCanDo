package com.phonecando.agents.kit

/**
 * One event from an engine's stream, in terms every kind maps onto
 * (AgentKind.parseEvent). The supervisor reads streams for activity,
 * telemetry, alerts and the chats the notification lists
 * (engine/EngineStreams): any kind but OTHER marks the engine used,
 * notify/AlertRules turns verdicts and waits into an agent's alert and
 * notify/ChatBoard tracks each chat's state. `sessionCreated` is true for a new top-level session,
 * `childCreated` for a subagent's child session (both keep kind OTHER);
 * EngineStreams counts the first once per agent and session.
 */
data class EngineEvent(
  val kind: Kind,
  val sessionId: String?,
  val sessionCreated: Boolean = false,
  val childCreated: Boolean = false,
  /** The session's new title, when the event renamed it (kind stays OTHER). */
  val title: String? = null,
) {
  enum class Kind {
    /** Generation activity: step/text/part/message movement. */
    WORKING,

    /** The run is blocked on the user: a permission request or a form. */
    WAITING,

    /** The run ended cleanly. */
    FINISHED,

    /** The run failed. */
    FAILED,

    /** The user stopped the run: no verdict. */
    STOPPED,

    /** Session deleted elsewhere. */
    GONE,

    /** Anything else (connection, catalog, TUI toasts…). */
    OTHER,
  }
}
