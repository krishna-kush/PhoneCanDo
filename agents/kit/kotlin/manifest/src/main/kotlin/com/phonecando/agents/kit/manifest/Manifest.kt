package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

// The parts of an agent.json (schema agents/kit/schema/agent.schema.json)
// the phone reads at run time, the install blocks (Install.kt) included. Fields only the build, CI or the kit CLI use
// (build, licence, the payload's sources…) are not modelled. Templates stay
// unrendered here: kit-render fills their {{placeholders}}. Blocks we only
// hand on to the app (the web adapter, signIn) stay JSON trees, verbatim.
data class Manifest(
  /** Where it came from: packaged with the app, or added by the user. */
  val origin: Origin,
  val id: String,
  val label: String,
  val version: String,
  /** "native" | "image". */
  val type: String,
  val channels: List<String>,
  /** "stable" | "preview". */
  val stability: String,
  /** `default`: the kind a fresh install starts with (at most one bundled kind, never a user's). */
  val isDefault: Boolean,
  /** The packaged names of a native kind's libs (`payload.libs[].name`); empty for none. */
  val payloadLibs: List<String>,
  /** `requires.linux`; null when the manifest does not say. */
  val linux: LinuxNeed?,
  /** Commands the kind needs on the guest PATH (`requires.commands`); empty for none. */
  val commands: List<String>,
  /** The runtime plugins the kind needs (`requires.runtimes`), installed before it; empty for none. */
  val runtimes: List<RuntimeNeed>,
  /** How the kind is installed into its machine; null: it is not. */
  val install: Install?,
  val update: Update?,
  /** What reads the installed version; an install always has one. */
  val versionCheck: VersionCheck?,
  val config: Config?,
  val engine: Engine?,
  val events: List<EventSource>,
  val chats: Chats?,
  val idle: Idle?,
  val surfaces: Surfaces?,
  /** How the kind reaches the phone tools (`phoneTools`); null when the manifest does not say, which is none. */
  val phoneTools: PhoneTools?,
  /** The sign-in options the app shows, verbatim; empty when the manifest has none. */
  val signIn: JsonArray,
  /** The code hooks this kind uses, by id (agents/builtin registers them). */
  val hooks: List<String>,
  /** How it takes a local model (`models`), in the order it prefers the APIs; empty: it does not. */
  val models: List<ModelWiring> = emptyList(),
)

enum class Origin(val wire: String) {
  /** Packaged in the APK (assets/agents/<id>/agent.json). */
  BUNDLED("bundled"),

  /** Added by the user (files/state/agent-kinds/user/<id>.json). */
  USER("user"),
}

/**
 * How a kind reaches the phone tools over the bridge. Only a kind that names
 * one of them gets the bridge in its engine's env; NONE, like a manifest that
 * says nothing, keeps the bridge (its URL and the agent's token) from it.
 */
enum class PhoneTools(val wire: String) {
  /** Its own plugin, packaged in its config (opencode). */
  PLUGIN("plugin"),

  /** An MCP server in a config file it reads. */
  MCP_CONFIG("mcp:config"),

  /** An MCP server in its launch args. */
  MCP_ARGV("mcp:argv"),

  NONE("none"),
}

/** Whether a kind needs a Linux image. */
enum class LinuxNeed(val wire: String) {
  REQUIRED("required"),
  OPTIONAL("optional"),
  NONE("none"),
}

/** The kind's config, seeded into `into` under HOME (from assets/agents/<id>/config). */
data class Config(
  val into: String,
  /** Seeded only when absent, so user edits survive. */
  val keep: List<String>,
  /** The global instructions file the image's OS note goes into, relative to [into]. */
  val instructions: String?,
)

enum class EngineStyle(val wire: String) {
  /** A loopback server the app and the TUI client attach to. */
  SERVER("server"),

  /** The agent's own TUI in a PTY. */
  TUI("tui"),
}

data class Engine(
  val style: EngineStyle,
  val launch: Command?,
  val auth: Auth?,
  val readiness: Readiness?,
  val resume: Resume?,
)

/** A process to start: argv items, env and an optional working directory, all templates. */
data class Command(
  val argv: List<ArgvItem>,
  /** In manifest order. */
  val env: Map<String, String>,
  val cwd: String?,
)

sealed interface ArgvItem {
  data class Text(val template: String) : ArgvItem

  /** [args], only when the placeholder [placeholder] has a non-empty value. */
  data class When(val placeholder: String, val args: List<String>) : ArgvItem
}

/** How every request to the engine authenticates. */
data class Auth(val basic: BasicAuth?)

/** HTTP Basic with the engine password under a fixed user. */
data class BasicAuth(val user: String)

/**
 * When the engine counts as ready, one rule: [http] answers 200 (server); a
 * TUI's first [output] and then quiet, or [alive] for a while.
 */
data class Readiness(val http: HttpPath?, val output: OutputReadiness?, val alive: AliveReadiness?)

data class HttpPath(val path: String)

/** Ready after the first output and then [settleMs] of quiet; failed after [timeoutSec] without. Null: the default. */
data class OutputReadiness(val settleMs: Int?, val timeoutSec: Int?)

/** Ready once the program has run [ms]. Null: the default. */
data class AliveReadiness(val ms: Int?)

/** Args (templates) added when the engine relaunches an agent that ran before: at argv index [at], or appended. */
data class Resume(val args: List<String>, val at: Int?)

sealed interface EventSource {
  /** A server-sent event stream at [path], read by the parser hook [parser]. */
  data class Sse(val path: String, val parser: String) : EventSource

  /** Rules over a TUI engine's PTY output. */
  data class Pty(val rules: List<PtyRule>) : EventSource

  /** Names a TUI kind's own hooks pass to `phonecando-event`, each mapped to the engine event it raises, in manifest order. */
  data class Hook(val map: Map<String, PtyEvent>) : EventSource
}

/** [on] in the PTY output raises [event]; [match], a regex over the signal's text, narrows it. */
data class PtyRule(val on: PtySignal, val match: String?, val event: PtyEvent)

enum class PtySignal(val wire: String) {
  /** A bell (BEL outside any escape sequence). */
  BEL("bel"),

  /** OSC 9 (a notification); its text is what follows `9;`. */
  OSC9("osc9"),

  /** OSC 777;notify; its text is what follows `777;notify;`. */
  OSC777("osc777"),

  /** OSC 9;4 progress; its text is what follows `9;4;` (state;value). */
  PROGRESS("progress"),

  /**
   * OSC 7501, a Program Status Protocol report the spec keeps; its text is
   * the report after `7501;` worded one way (kit-term ProgramStatus):
   * `state=<state>` first, then `id`, `kind`, `progress`, `app`, `title`, `msg`.
   */
  OSC7501("osc7501"),
}

/** The engine event a PTY rule or a hook event raises. */
enum class PtyEvent(val wire: String) {
  WORKING("working"),
  WAITING("waiting"),
  FINISHED("finished"),
  FAILED("failed"),

  /** The run ended with no verdict (you stopped it), or its result was seen: the chat leaves the board, no alert. */
  STOPPED("stopped"),
}

/** Where a chat's title is read: GET [path], then the JSON pointer [pointer]. */
data class Chats(val title: TitleSource?)

data class TitleSource(val path: String, val pointer: String)

/** Idle once nothing from [from] happened for [quietSec] seconds. */
data class Idle(val from: List<String>, val quietSec: Int)

enum class HomeSurface(val wire: String) {
  WEB("web"),
  TUI("tui"),
}

data class Surfaces(
  /** What the agent's Home tab shows. */
  val home: HomeSurface,
  val web: WebSurface?,
  val terminal: TerminalSurface?,
  /** A TUI engine's chat title: a regex whose group 1 is it, in the OSC 0/2 window title. */
  val chatTitle: String?,
)

data class WebSurface(
  val pair: WebPair?,
  /** The app's web adapter spec, verbatim. */
  val adapter: JsonObject?,
)

/** A one-time sign-in URL for the web UI: [method] [path], the code from the first of [code] that has one, then [url]. */
data class WebPair(
  val method: String,
  val path: String,
  /** JSON pointers into the response, tried in order. */
  val code: List<String>,
  /** Relative to the engine's base URL; `{{code}}` is the code. */
  val url: String,
)

data class TerminalSurface(
  /** The kind's TUI attached to the running engine. */
  val client: Command?,
  /** A regex whose group 1 is the chat title in the TUI's terminal title. */
  val chatTitle: String?,
)
