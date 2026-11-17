package com.phonecando.runner.engine

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.LaunchSpec
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.ProjectDir
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.render.GuestEnvPolicy
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.render.LaunchRenderer
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.agents.kit.render.Templates
import com.phonecando.linux.LinuxHost
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.AssetManagerTree
import com.phonecando.runner.agents.ConfigSeeder
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.install.AgentInstalls
import com.phonecando.runner.engine.acp.AcpBridge
import com.phonecando.runner.engine.acp.AcpSetup
import com.phonecando.runner.engine.acp.AcpSpawner
import com.phonecando.runner.engine.events.KitFiles
import com.phonecando.runner.engine.image.AgentFiles
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.engine.image.MachineNotes
import com.phonecando.runner.engine.image.OsNote
import com.phonecando.runner.engine.image.PhoneCanDoNote
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.spawn.ServerSpawner
import com.phonecando.runner.engine.spawn.TuiSpawner
import com.phonecando.runner.engine.tui.TerminalThemes
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.messages.delivery.InboxFolder
import java.io.File

/** What one launch of an agent's engine needs; kept for a relaunch on a fresh port. */
internal data class LaunchPlan(
  val record: AgentRecord,
  val kind: ManifestKind,
  val image: ImageDir,
  val home: File,
  /** The image's engine.env, with HOME and TMPDIR set. */
  val imageEnv: Map<String, String>,
  /** SystemClock.elapsedRealtime() of the start request (boot time). */
  val requestedAt: Long,
  /** The launch adds the kind's resume args: the agent ran before (ResumeFallback may drop them). */
  val resume: Boolean = record.ranBefore,
  /** The local model server the agent runs on (LocalModelBinding); null: its own setup. Holds the server's key. */
  val model: ModelEndpoint? = null,
  /** The agent's own state folder (AgentFiles), made; null: it keeps its state where its kind does. */
  val stateDir: File? = null,
  /**
   * The first prompt this start runs (StartPrompts: a scheduled task), for
   * a kind that promptsAtStart; in ACP mode for any kind, sent by its
   * driver rather than put in argv. Null: none.
   */
  val prompt: String? = null,
  /** How the engine runs: its TUI or server, or ACP mode (engine.acp). */
  val mode: EngineMode = EngineMode.TERMINAL,
  /** The first prompt wants a chat of its own. */
  val newChat: Boolean = false,
  /** The first prompt goes on in the chat this launch reopens, never in a new one (StartPrompt.sameChat). */
  val sameChat: Boolean = false,
  /** Terminal mode: the chat ACP mode left (AgentRecord.acpChat), which this launch opens (engine.acp.chat); null: none. */
  val chatId: String? = null,
) {
  /** A server engine's output, or an ACP engine's stderr; per agent, as a machine may run several engines. */
  val logFile: File get() = image.engineLog(record.id)

  /** A TUI engine's events file, host path (KitFiles). */
  val eventsFile: File get() = KitFiles.events(home, record.id)
}

// Turns an agent into a running engine process. plan() reads the image
// (engine.env), makes the work folder in HOME ({{projectDir}}, ProjectDir;
// an image kind's guest sees it at /root/projects, so its `cd` there cannot
// fail) and, for an agent that keeps its own state, its state folder with
// the kind's folders in it (AgentFiles); seeds the kind's config into its
// config dir (ConfigSeeder, then the note on PhoneCanDo, PhoneCanDoNote,
// and the image's OS note into the kind's instructions file), for a TUI engine the kit scripts and the agent's
// empty events file (KitFiles), the agent's inbox folder with its
// undelivered messages for a kind with an `inbox` block (messages/), and
// the machine-mates note into every instructions file on the machine
// (MachineNotes). It takes the agent's first prompt for this start
// (StartPrompts: a scheduled task) when its kind can start with one; one
// that wants a chat of its own starts without the resume args. spawn()
// renders the kind's launch (its resume args when the agent ran before,
// or the chat ACP mode left when the kind can open one, its first prompt,
// its local model's wiring when it has one, its state folder; an image
// kind through its image's shell, carrying what the machine's launch.conf
// would take from it: EngineEnv.carry) and
// starts it in its cwd (HOME when it names none; an image kind's guest sh
// changes dir itself) with the layered environment (EngineEnv) by the
// kind's engine style: a server from the native-library dir, the only
// place Android lets us exec, with stdout + stderr in
// <image>/logs/engine-<agentId>.log (ServerSpawner); a TUI on a PTY of its
// own, with what a terminal program needs in its env (TuiSpawner); in ACP
// mode the kind's ACP program (acpLaunch) on pipes, its stderr in that
// log, prepared as its TUI is (kit scripts, events file, inbox: its hooks
// still run) but with its first prompt left to its driver, and the bridge
// out of its env when the kind hands it in the chat (AcpSpawner).
internal class EngineLauncher(private val context: Context) {
  private val libDir: String = context.applicationInfo.nativeLibraryDir
  private val assets by lazy { AssetManagerTree(context.assets) }
  private val seeder by lazy { ConfigSeeder(assets) }

  // Our version, as an ACP engine's initialize names its client.
  private val appVersion: String by lazy {
    try {
      context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0"
    } catch (_: Exception) {
      "0"
    }
  }

  // The Gradle flavor (full|lite|play) from the manifest meta-data; the
  // agent's plugins register phone-control tools only in full builds.
  private val channel: String by lazy {
    try {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        .metaData?.getString("com.phonecando.channel") ?: "full"
    } catch (_: Exception) {
      "full"
    }
  }

  /** Throws image_not_ready while the image has no engine.env. */
  fun plan(record: AgentRecord, kind: ManifestKind, requestedAt: Long, mode: EngineMode = EngineMode.TERMINAL): LaunchPlan {
    // Taken first, so a start that fails here never leaves it for a later one.
    val start = startPrompt(record.id, kind, mode)
    if (MachinePrep.take(record.id)) prepareMachine(record)
    val image = ImageDir.of(context.filesDir, record.imageId)
    val env = image.readEnv()
    val home = File(env.getValue("HOME")).apply { mkdirs() }
    ProjectDir.of(home).mkdirs()
    File(env.getValue("TMPDIR")).mkdirs()
    image.logs.mkdirs()
    val stateDir = AgentFiles.ownState(home, record)?.also { makeState(kind, home, it) }
    val note = PhoneCanDoNote.Facts(
      name = record.name,
      kind = kind.displayName,
      linux = LINUX_IMAGE in env,
      full = channel == "full",
      phoneTools = BridgeAccess.granted(kind.manifest),
    )
    seedConfig(kind, home, stateDir, image, note)
    if (kind.style == EngineStyle.TUI) seedKit(home, record.id)
    prepareInbox(record.id)
    refreshMachineNotes(record.imageId, home)
    return LaunchPlan(
      record, kind, image, home, env, requestedAt,
      resume = if (start?.newChat == true) false else record.ranBefore,
      stateDir = stateDir,
      prompt = start?.prompt,
      mode = mode,
      newChat = start?.newChat == true,
      sameChat = start?.sameChat == true,
      chatId = if (mode == EngineMode.TERMINAL) chatToOpen(record, kind, start) else null,
    )
  }

  // The chat ACP mode left, for a terminal launch of a kind that can open
  // one (engine.acp.chat): opened once, so later launches resume as usual;
  // a task that wants a chat of its own wins over it.
  private fun chatToOpen(record: AgentRecord, kind: ManifestKind, start: StartPrompt?): String? {
    val chat = record.acpChat ?: return null
    // Its own app takes over, so the kept chat is no longer where it is
    // (ACP mode goes back to a kept one first, acp/AcpChats): cleared on
    // every terminal launch, opened by those that can.
    try {
      AgentStores.get(context).clearAcpChat(record.id)
    } catch (e: Exception) {
      Log.w(TAG, "ACP chat of ${record.id} not cleared", e)
    }
    if (!kind.opensChat) return null
    return chat.takeIf { start?.newChat != true }
  }

  // A start with no app around (MachinePrep): the machine readied as the
  // app readies it before its own starts, with the whole machine's guest
  // env list, so launch.conf reads the same whoever asks.
  private fun prepareMachine(record: AgentRecord) {
    val unset = AgentInstalls(AgentStores.get(context), KindCatalogs.get(context)).machineUnset(record.imageId)
    try {
      LinuxHost.get(context).images.prepareForStart(record.imageId, unset)
    } catch (e: Exception) {
      throw EngineStartException(
        EngineStartError.IMAGE_NOT_READY,
        "its machine could not be readied: ${e.message ?: e.javaClass.simpleName}",
      )
    }
  }

  // The agent's first prompt for this start, when its kind can start with
  // one (in ACP mode any kind can: its driver sends it); a kind that cannot
  // (the schedule wakes those instead) drops it.
  private fun startPrompt(agentId: String, kind: ManifestKind, mode: EngineMode): StartPrompt? {
    val start = StartPrompts.take(agentId) ?: return null
    if (kind.promptsAtStart || mode == EngineMode.ACP) return start
    Log.w(TAG, "${kind.displayName} cannot start with a prompt; $agentId starts without its task")
    return null
  }

  /**
   * [port]: a server engine's; null for a TUI. Throws engine_missing,
   * image_not_ready (an image kind's image has no Linux) or start_failed;
   * counts the attempt for telemetry unless it is the same start again
   * ([counted] false).
   */
  fun spawn(plan: LaunchPlan, port: Int?, bridgeUrl: String?, counted: Boolean = true): EngineProcess {
    val tmp = File(plan.imageEnv.getValue("TMPDIR"))
    val acp = plan.mode == EngineMode.ACP
    val ctx = LaunchContext(
      libDir = libDir,
      home = plan.home,
      tmp = tmp,
      port = port?.toString().orEmpty(),
      password = plan.record.password,
      image = plan.image.root,
      resume = plan.resume,
      model = plan.model,
      bridgeUrl = bridgeUrl.orEmpty(),
      stateDir = plan.stateDir,
      prompt = plan.prompt.takeIf { !acp },
      chatId = plan.chatId,
    )
    val first = render(plan, ctx)
    val tui = plan.kind.style == EngineStyle.TUI
    val kitHome = kitHome(plan)
    // ACP mode is a TUI kind's without a screen: no terminal env, the same events file and inbox.
    val image = when {
      acp -> plan.imageEnv + browser(plan, kitHome)
      tui -> plan.imageEnv + EngineEnv.terminal(TerminalThemes.current) + browser(plan, kitHome)
      else -> plan.imageEnv
    }
    // Tools "session": the bridge goes in its chats (AcpSetup), not its env.
    val inSession = acp && plan.kind.acpBridgeInSession && bridgeUrl != null
    val built = EngineEnv.build(
      base = System.getenv(),
      image = image,
      kind = first.env,
      bridgeUrl = bridgeUrl.takeIf { !inSession },
      bridgeToken = plan.record.bridgeToken,
      channel = channel,
      agentId = plan.record.id,
      eventsFile = if (tui) KitFiles.events(kitHome, plan.record.id).path else null,
      inboxDir = if (plan.kind.inbox != null) InboxFolder.dir(kitHome, plan.record.id).path else null,
    )
    // An image kind's engine is a guest of its machine: what launch.conf
    // unsets there (for another agent's kind) and this engine needs goes
    // in under its carry name, and the launch, rendered again with it,
    // puts it back.
    val carry = if (plan.kind.manifest.type == TYPE_IMAGE) GuestEnvPolicy.carry(built.keys, machineUnset(plan.record.imageId)) else emptySet()
    val spec = if (carry.isEmpty()) first else render(plan, ctx.copy(carry = carry))
    val env = EngineEnv.carry(built, carry)
    if (counted) TelemetryRecorder.engineStartRequested()
    val binary = File(spec.argv.first())
    if (!binary.exists()) {
      TelemetryRecorder.engineStartFailed()
      throw missing(plan.kind)
    }
    if (!binary.canExecute()) binary.setExecutable(true)
    val cwd = spec.cwd?.let(::File) ?: plan.home
    return try {
      when {
        acp -> {
          val bridge = if (inSession) AcpBridge(checkNotNull(bridgeUrl), plan.record.bridgeToken) else null
          val setup = AcpSetup(sessionCwd(plan, ctx, spec), plan.kind.acpMeta(ctx), plan.kind.acpOptions, bridge, appVersion) {
            plan.kind.acpHomeOptions(plan.home)
          }
          AcpSpawner.spawn(spec.argv, env, cwd, plan.logFile, setup)
        }
        tui -> TuiSpawner.spawn(spec.argv, env, cwd, handOver = plan.kind.manifest.type == TYPE_IMAGE)
        else -> ServerSpawner.spawn(spec.argv, env, cwd, plan.logFile)
      }
    } catch (e: Exception) {
      TelemetryRecorder.engineStartFailed()
      throw EngineStartException(EngineStartError.START_FAILED, "launch failed: ${e.message ?: e.javaClass.simpleName}")
    }
  }

  // The kind's launch for this plan: in ACP mode its ACP program.
  private fun render(plan: LaunchPlan, ctx: LaunchContext): LaunchSpec {
    if (plan.mode == EngineMode.TERMINAL) return plan.kind.launch(ctx)
    return plan.kind.acpLaunch(ctx)
      ?: throw EngineStartException(EngineStartError.START_FAILED, "${plan.kind.displayName} has no ACP mode")
  }

  // An ACP chat's folder as the agent sees it: its launch cwd (HOME when it
  // names none), for an image kind the guest's, which its sh enters.
  private fun sessionCwd(plan: LaunchPlan, ctx: LaunchContext, spec: LaunchSpec): String {
    if (plan.kind.manifest.type != TYPE_IMAGE) return spec.cwd ?: plan.home.path
    val guest = ctx.copy(home = File(ImageLaunch.GUEST_HOME), tmp = File(ImageLaunch.GUEST_TMP))
    val cwd = plan.kind.manifest.engine?.launch?.cwd ?: return ImageLaunch.GUEST_HOME
    return try {
      Templates.render(cwd, LaunchRenderer.values(guest))
    } catch (e: Exception) {
      Log.w(TAG, "ACP chat folder not rendered; using HOME", e)
      ImageLaunch.GUEST_HOME
    }
  }

  // HOME as the engine names it, for the kit's paths in its env: an image
  // kind's program sees the guest's (ImageLaunch), whose HOME is bound to
  // the same folder.
  private fun kitHome(plan: LaunchPlan): File =
    if (plan.kind.manifest.type == TYPE_IMAGE) File(ImageLaunch.GUEST_HOME) else plan.home

  // An image kind's TUI opens links through the kit (KitFiles.opener) unless
  // its own env says otherwise (the kind's layer comes after this one).
  private fun browser(plan: LaunchPlan, kitHome: File): Map<String, String> =
    if (plan.kind.manifest.type == TYPE_IMAGE) mapOf(BROWSER to KitFiles.opener(kitHome).path) else emptyMap()

  // An image kind runs through its image's shell, which only a Linux image has.
  private fun missing(kind: ManifestKind) = if (kind.manifest.type == TYPE_IMAGE) {
    EngineStartException(EngineStartError.IMAGE_NOT_READY, "${kind.displayName} needs a Linux image")
  } else {
    EngineStartException(EngineStartError.ENGINE_MISSING, "${kind.displayName} is not in this build")
  }

  // The kind's assets folder (packaged per variant by the module's Gradle
  // syncAgentConfig task) into its config dir (under HOME, or in the
  // agent's [stateDir]), pruning files we no longer ship; then the note on
  // PhoneCanDo ([note]'s parts from the packaged assets) and the OS note
  // into its instructions file. A failure here never blocks a start.
  private fun seedConfig(kind: AgentKind, home: File, stateDir: File?, image: ImageDir, note: PhoneCanDoNote.Facts) {
    try {
      val config = kind.config
      val dir = kind.configDir(home, stateDir)
      if (config != null && dir != null) seeder.seed(config, dir)
    } catch (e: Exception) {
      Log.w(TAG, "agent config seed failed", e)
    }
    try {
      val instructions = kind.instructionsFile(home, stateDir) ?: return
      PhoneCanDoNote.apply(instructions, PhoneCanDoNote.body(note, ::notePart))
      OsNote.apply(instructions, image.osNote)
    } catch (e: Exception) {
      Log.w(TAG, "instructions notes not written", e)
    }
  }

  // One part of the note on PhoneCanDo; null when it is not packaged.
  private fun notePart(name: String): String? = try {
    assets.open("${PhoneCanDoNote.ASSET_DIR}/$name").use { it.readBytes().toString(Charsets.UTF_8) }
  } catch (_: Exception) {
    null
  }

  // The agent's state folder and what the kind keeps in it (AgentFiles);
  // a kind that cannot take one fails its launch with the reason, so a
  // failure here never blocks a start.
  private fun makeState(kind: AgentKind, home: File, stateDir: File) {
    try {
      AgentFiles.makeState(kind, home, stateDir)
    } catch (e: Exception) {
      Log.w(TAG, "state folder not made", e)
    }
  }

  // The kit scripts and the agent's empty events file (KitFiles); a TUI
  // that cannot raise events still runs, so a failure here never blocks a
  // start.
  private fun seedKit(home: File, agentId: String) {
    try {
      KitFiles.prepare(assets, home, agentId)
    } catch (e: Exception) {
      Log.w(TAG, "kit scripts not seeded", e)
    }
  }

  // The agent's inbox folder made and its undelivered messages put in it
  // (Messages: nothing for a kind without an `inbox` block); a failure here
  // never blocks a start (the agent can still pull with agents_inbox).
  private fun prepareInbox(agentId: String) {
    try {
      Messages.get(context).engineStarting(agentId)
    } catch (e: Exception) {
      Log.w(TAG, "inbox not prepared", e)
    }
  }

  // Who else is on the machine, in every agent's instructions there; a
  // note that cannot be written never blocks a start.
  private fun refreshMachineNotes(imageId: String, home: File) {
    try {
      MachineNotes(AgentStores.get(context), KindCatalogs.get(context)::get).refresh(imageId, home) { agent, e ->
        Log.w(TAG, "machine note for ${agent.id} not written", e)
      }
    } catch (e: Exception) {
      Log.w(TAG, "machine notes not written", e)
    }
  }

  // What the machine's launch.conf unsets for its guests (JS writes it
  // before each start of any agent there), read on every spawn so a
  // relaunch sees an agent that joined since; carrying a name it does not
  // unset is harmless. Nothing to carry when it cannot be read.
  private fun machineUnset(imageId: String): List<String> = try {
    AgentInstalls(AgentStores.get(context), KindCatalogs.get(context)).machineUnset(imageId)
  } catch (e: Exception) {
    Log.w(TAG, "guest unset not read", e)
    emptyList()
  }

  private companion object {
    const val TAG = "PhoneCanDoEngine"
    const val TYPE_IMAGE = "image"
    const val BROWSER = "BROWSER"

    // engine.env names it only for a Linux image (ImageLayout).
    const val LINUX_IMAGE = "PHONECANDO_IMAGE"
  }
}
