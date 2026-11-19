package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.PhoneTools
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.render.ManifestKind
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import java.io.PrintStream

// kit-cli render-launch: an image kind's engine launch, terminal or ACP
// mode, as the runner starts it on a machine with no other agent: the kit's
// own launch (ManifestKind: argv, the kind's env, its state env, its ACP
// env, its runtimes on PATH, the guest sh that enters its cwd), with the
// image's sh as /bin/sh, and the runner's env layers around the kind's (its
// EngineEnv): the terminal's (a TUI on our PTY) and BROWSER first, the
// bridge URL, events file, inbox folder, channel and agent tag on top. No
// bridge token: `token` names the variable the caller sets to a stand-in
// when the kind gets one. An agent with --state keeps its state in a folder
// of its own, as a second agent of its kind does. For agents-latest.yml.
//
// One JSON line on stdout:
//   {"kind", "mode", "argv", "env", "token", "configDir", "kitBin"}
// configDir is where the runner seeds the kind's config (null: none),
// kitBin where it puts the kit's scripts (phonecando-event, -inbox, -open).
object RenderLaunch {
  const val USAGE = "kit-cli render-launch --kind <dir> [--mode terminal|acp] [--bridge-url <url>] [--agent <id>] [--state] [--channel <c>] [--runtimes <dir>]"

  const val TERMINAL = "terminal"
  const val ACP = "acp"

  // The runner's names and folders (EngineEnv, KitFiles, InboxFolder, AgentFiles).
  private const val BRIDGE_URL = "PHONECANDO_BRIDGE_URL"
  private const val BRIDGE_TOKEN = "PHONECANDO_BRIDGE_TOKEN"
  private const val CHANNEL = "PHONECANDO_CHANNEL"
  private const val EVENTS = "PHONECANDO_EVENTS"
  private const val INBOX = "PHONECANDO_INBOX"
  private const val AGENT = "PHONECANDO_AGENT"
  private const val KIT_BIN = ".phonecando/bin"
  private val TERMINAL_ENV = mapOf("TERM" to "xterm-256color", "COLORTERM" to "truecolor", "LANG" to "C.UTF-8")

  private val AGENT_ID = Regex("[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
  private val BASE_URL = Regex("https?://[^\\s/]+(/\\S*)?")

  /** What render-launch was asked for. */
  data class Request(
    val kind: File,
    val mode: String,
    /** The bridge's base URL; null: the bridge is down, so no kind gets it. */
    val bridgeUrl: String?,
    val agent: String,
    val ownState: Boolean,
    val channel: String,
    val runtimes: File,
  )

  /** The request in [args] (after the command). Throws IllegalArgumentException for bad usage. */
  fun parse(args: List<String>): Request {
    val options = Options.parse(
      args,
      valued = setOf("--kind", "--mode", "--bridge-url", "--agent", "--channel", "--runtimes"),
      flags = setOf("--state"),
    )
    val kind = File(options.required("--kind"))
    val mode = options.opt("--mode") ?: TERMINAL
    require(mode == TERMINAL || mode == ACP) { "--mode is $TERMINAL or $ACP" }
    val bridgeUrl = options.opt("--bridge-url")?.trimEnd('/')
    require(bridgeUrl == null || BASE_URL.matches(bridgeUrl)) { "--bridge-url is an http(s) URL" }
    val agent = options.opt("--agent") ?: "ci"
    require(AGENT_ID.matches(agent)) { "--agent is an agent id: letters, digits, '.', '_', '-'" }
    return Request(
      kind = kind,
      mode = mode,
      bridgeUrl = bridgeUrl,
      agent = agent,
      ownState = options.flag("--state"),
      channel = options.opt("--channel") ?: "full",
      runtimes = options.opt("--runtimes")?.let(::File) ?: KitFolders.runtimesBeside(kind),
    )
  }

  fun run(request: Request, out: PrintStream, err: PrintStream): Int {
    val manifest = KitFolders.kind(request.kind)
    val id = manifest.id
    if (manifest.type != TYPE_IMAGE) throw Refused("$id is a ${manifest.type} kind; render-launch renders an image kind's")
    val kind = ManifestKind.of(manifest, StandInHooks(manifest), KitFolders.runtimes(request.runtimes))
    val acp = request.mode == ACP
    if (acp && !kind.speaksAcp) throw Refused("$id has no ACP mode (engine.acp)")

    val home = File(ImageLaunch.GUEST_HOME)
    // BridgeAccess: only a kind that names a way to the phone tools gets the bridge.
    val bridgeUrl = request.bridgeUrl.takeIf { manifest.phoneTools.let { it != null && it != PhoneTools.NONE } }
    // Tools "session": the bridge goes in its chats, not its env.
    val bridgeInEnv = bridgeUrl.takeIf { !(acp && kind.acpBridgeInSession) }
    val stateDir = if (request.ownState) File(home, ".phonecando/agents/${request.agent}") else null
    val ctx = LaunchContext(
      libDir = "",
      home = home,
      tmp = File(ImageLaunch.GUEST_TMP),
      port = "",
      password = "",
      image = File("/"),
      bridgeUrl = bridgeUrl.orEmpty(),
      stateDir = stateDir,
    )
    val spec = if (acp) kind.acpLaunch(ctx)!! else kind.launch(ctx)
    // The image's shims/sh, our launcher into the guest, is the machine's own sh here.
    val argv = listOf(GUEST_SH) + spec.argv.drop(1)

    val tui = kind.style == EngineStyle.TUI
    val env = LinkedHashMap<String, String>()
    if (tui && !acp) env.putAll(TERMINAL_ENV)
    env["BROWSER"] = "${home.path}/$KIT_BIN/phonecando-open"
    env.putAll(spec.env)
    listOf(BRIDGE_URL, BRIDGE_TOKEN, EVENTS, INBOX).forEach(env::remove)
    if (bridgeInEnv != null) env[BRIDGE_URL] = bridgeInEnv
    if (tui) env[EVENTS] = "${home.path}/.phonecando/events-${request.agent}"
    if (manifest.inbox != null) env[INBOX] = "${home.path}/.phonecando/inbox-${request.agent}"
    env[CHANNEL] = request.channel
    env[AGENT] = request.agent

    out.println(
      buildJsonObject {
        put("kind", id)
        put("mode", request.mode)
        put("argv", JsonArray(argv.map(::JsonPrimitive)))
        put("env", buildJsonObject { env.forEach { put(it.key, it.value) } })
        put("token", if (bridgeInEnv != null) JsonPrimitive(BRIDGE_TOKEN) else JsonNull)
        put("configDir", kind.configDir(home, stateDir)?.path?.let(::JsonPrimitive) ?: JsonNull)
        put("kitBin", "${home.path}/$KIT_BIN")
      },
    )
    err.println("kit-cli: $id in ${request.mode} mode: ${argv.size} args, ${env.size} env, bridge ${if (bridgeInEnv != null) "in env" else "not in env"}")
    return 0
  }

  // The kind's code hooks stand in as readers that read nothing: a launch
  // runs none of them, and ManifestKind loads a kind only with every hook it names.
  private class StandInHooks(manifest: Manifest) : KindHooks {
    override val id: String = manifest.id
    private val names = manifest.hooks.toSet()

    override fun sseParser(name: String) = if (name in names) { _: String -> null } else null

    override fun acpOptions(name: String) = if (name in names) { _: File -> emptyMap<String, String>() } else null
  }

  private const val GUEST_SH = "/bin/sh"
  private const val TYPE_IMAGE = "image"
}
