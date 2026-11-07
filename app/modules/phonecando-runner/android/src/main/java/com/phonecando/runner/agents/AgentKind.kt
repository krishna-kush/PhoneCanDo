package com.phonecando.runner.agents

import java.io.File

// One kind of coding agent the phone can run (opencode is the first).
// Everything the engine host needs to know about a kind sits behind this
// interface: how to start its engine, how to ask whether it is up, its event
// stream and its config. The service, health checks and telemetry go through
// it and never name an agent. Pure Kotlin, no Android imports.
interface AgentKind {
  /** Stable id kept in records and sent from JS ("opencode"). */
  val id: String

  /** Short name for notifications and logs. */
  val displayName: String

  /** The config this kind seeds into the engine HOME, or null for none. */
  val config: AgentConfig?

  /** The kind's own argv and env; the host adds HOME, TMPDIR and the bridge. */
  fun launch(ctx: LaunchContext): LaunchSpec

  /** Request that answers 200 once the engine serves requests. */
  fun healthProbe(port: String, password: String): HttpProbe

  /** The engine's server-sent event stream, or null when it has none. */
  fun eventStream(port: String, password: String): HttpProbe?

  /** One `data:` frame of that stream; null when it carries nothing we read. */
  fun parseEvent(frame: String): EngineEvent?

  /** Request for one session (a chat), for its title; null when the kind has none. */
  fun sessionInfo(port: String, password: String, sessionId: String): HttpProbe? = null

  /** The chat's title from that response; null when it has none. */
  fun parseSessionTitle(body: String): String? = null

  /** Every form of the engine password that can show up in a log line. */
  fun passwordForms(password: String): List<String>
}

/** What any engine launch knows, whatever the kind. */
data class LaunchContext(
  /** The APK's native-library dir: the only place Android lets us exec. */
  val libDir: String,
  val home: File,
  val port: String,
  val password: String,
)

/** The kind's part of a launch: argv[0] is the engine binary. */
data class LaunchSpec(val argv: List<String>, val env: Map<String, String>)

/**
 * A kind's config: an APK assets folder copied into a folder under the engine
 * HOME on every start. Files in [keepIfPresent] are seeded only when absent,
 * so user edits and keys in them survive. [instructionsFile] (relative to
 * [homeDir]) is the agent's global instructions, where the image's OS note
 * goes; null for a kind without one.
 */
data class AgentConfig(
  val assetDir: String,
  val homeDir: String,
  val keepIfPresent: Set<String>,
  val instructionsFile: String? = null,
)
