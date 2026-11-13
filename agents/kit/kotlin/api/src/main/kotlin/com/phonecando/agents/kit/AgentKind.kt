package com.phonecando.agents.kit

import java.io.File

// One kind of coding agent the phone can run (opencode is the first).
// Everything the engine host needs to know about a kind sits behind this
// interface: how to start its engine, how to ask whether it is up, its event
// stream, its config and how other agents' messages reach it. The service, health checks and telemetry go through
// it and never name an agent. kit-render's ManifestKind builds one from the
// kind's agent.json plus its KindHooks. Pure Kotlin, no Android imports.
interface AgentKind {
  /** Stable id kept in records and sent from JS ("opencode"). */
  val id: String

  /** Short name for notifications and logs. */
  val displayName: String

  /** The config this kind seeds into the engine HOME, or null for none. */
  val config: AgentConfig?

  /**
   * The kind can keep each agent's sign-in, settings, chats and global
   * instructions in a state folder of the agent's own, so a second agent of
   * it can share a machine with the first.
   */
  val ownStateSupported: Boolean get() = false

  /** How far other agents' messages reach an agent of it (MessagingLevel). */
  val messaging: MessagingLevel get() = MessagingLevel.NONE

  /**
   * An idle agent of it can be woken only while a hook it left waiting is
   * alive (`inbox.wake` "hook": the inbox folder's `waiter` file names it),
   * not whenever it is idle.
   */
  val wakeNeedsWaiter: Boolean get() = false

  /**
   * The agent's global instructions file, where the host writes the image's
   * OS note and who else is on the machine: in [stateDir], the agent's own
   * state folder, or in [home] when it has none (null: the kind's default
   * dirs). Host paths. Null when the kind has no instructions file.
   */
  fun instructionsFile(home: File, stateDir: File?): File? = null

  /** Where [config] is seeded for that agent, the same way; null when the kind has none. */
  fun configDir(home: File, stateDir: File?): File? = config?.let { File(home, it.homeDir) }

  /**
   * Where the kind keeps a user's sign-in, settings and chats by default,
   * in [home] (host path): what the host deletes, never following links,
   * when an agent that used the defaults leaves a machine that stays, so
   * the next agent of the kind there starts clean. Never anything the
   * machine's other agents share. Empty for none.
   */
  fun userStatePaths(home: File): List<File> = emptyList()

  /** The kind's own argv, env and cwd; the host adds the image env and the bridge, and runs it there (HOME when no cwd). */
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

  /** An idle agent of this kind can be woken by another agent's message (the manifest's `inbox.wake`). */
  val canWake: Boolean get() = false

  /**
   * The request that hands other agents' [messages] (rendered text) to the
   * engine's chat [sessionId]; null when the kind has no such [which] call,
   * or when the call names the chat and [sessionId] is blank.
   */
  fun inboxRequest(which: InboxCall, port: String, password: String, sessionId: String, messages: String): InboxRequest? = null

  /** The request for the agent's newest chat (`inbox.server.latest`), when the host knows none; null without one. */
  fun inboxLatestRequest(port: String, password: String): InboxRequest? = null

  /** The newest chat's id in what that request answered; null when it names none. */
  fun inboxLatestId(answer: String): String? = null

  /** The request that makes a new chat titled [title] (`inbox.server.create`), for a task that wants one; null without one. */
  fun inboxCreateRequest(port: String, password: String, title: String): InboxRequest? = null

  /** The new chat's id in what that request answered; null when it names none. */
  fun inboxCreatedId(answer: String): String? = null

  /**
   * Its engine can start with a first prompt (the manifest's
   * `engine.prompt`): LaunchContext.prompt goes in as one argv item, and
   * the TUI runs it as its first turn.
   */
  val promptsAtStart: Boolean get() = false

  /**
   * An agent of it can run a scheduled task: its engine starts with the
   * task as its first prompt, or the task can wake an idle one ([canWake]).
   */
  val runsSchedules: Boolean get() = promptsAtStart || canWake
}

/** What any engine launch knows, whatever the kind. */
data class LaunchContext(
  /** The APK's native-library dir: the only place Android lets us exec. */
  val libDir: String,
  val home: File,
  val tmp: File,
  /** The engine's port; "" for an engine that serves none (a TUI). */
  val port: String,
  val password: String,
  /** The agent's image folder; an image kind's program runs through its shims/sh. */
  val image: File? = null,
  /** The agent's engine ran before: the launch adds the kind's resume args. */
  val resume: Boolean = false,
  /** The local model the agent uses; null: whatever the agent itself is set up with. */
  val model: ModelEndpoint? = null,
  /** The phone-tools bridge's base URL; "" when the kind gets no bridge. Its token stays in the env. */
  val bridgeUrl: String = "",
  /** The agent's own state folder (host path), for a kind that supports one; null: the kind's default dirs. */
  val stateDir: File? = null,
  /**
   * Image kinds: the env names the image's launch.conf unsets (for its other
   * agents) that this engine still needs. The host passes each as
   * PHONECANDO_CARRY_<NAME>, and the image's sh restores it before the program.
   */
  val carry: Set<String> = emptySet(),
  /**
   * The first prompt the engine runs (a scheduled task), for a kind that
   * promptsAtStart: one argv item, never through a shell. Null: none.
   */
  val prompt: String? = null,
)

/** The kind's part of a launch: argv[0] is the engine binary; [cwd] null means HOME. */
data class LaunchSpec(val argv: List<String>, val env: Map<String, String>, val cwd: String? = null)

/**
 * A kind's config: an APK assets folder copied into a folder under the engine
 * HOME ([homeDir]; an agent with a state folder of its own: AgentKind.configDir)
 * on every start. Files in [keepIfPresent] are seeded only when absent, so
 * user edits and keys in them survive.
 */
data class AgentConfig(
  val assetDir: String,
  val homeDir: String,
  val keepIfPresent: Set<String>,
)
