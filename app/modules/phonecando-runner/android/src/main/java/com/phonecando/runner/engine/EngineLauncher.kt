package com.phonecando.runner.engine

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.ProjectDir
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.render.GuestEnvPolicy
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.linux.LinuxHost
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.AssetManagerTree
import com.phonecando.runner.agents.ConfigSeeder
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.install.AgentInstalls
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
  /** The first prompt this start runs (StartPrompts: a scheduled task), for a kind that promptsAtStart; null: none. */
  val prompt: String? = null,
) {
  /** A server engine's output; per agent, as a machine may run several engines. */
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
// its first prompt, its local model's wiring when it has one, its
// state folder; an image kind through its image's shell, carrying what
// the machine's launch.conf would take from it: EngineEnv.carry) and
// starts it in its cwd (HOME when it names none; an image kind's guest sh
// changes dir itself) with the layered environment (EngineEnv) by the
// kind's engine style: a server from the native-library dir, the only
// place Android lets us exec, with stdout + stderr in
// <image>/logs/engine-<agentId>.log (ServerSpawner); a TUI on a PTY of its
// own, with what a terminal program needs in its env (TuiSpawner).
internal class EngineLauncher(private val context: Context) {
  private val libDir: String = context.applicationInfo.nativeLibraryDir
  private val assets by lazy { AssetManagerTree(context.assets) }
  private val seeder by lazy { ConfigSeeder(assets) }

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
  fun plan(record: AgentRecord, kind: ManifestKind, requestedAt: Long): LaunchPlan {
    // Taken first, so a start that fails here never leaves it for a later one.
    val start = startPrompt(record.id, kind)
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
    )
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
  // one; a kind that cannot (the schedule wakes those instead) drops it.
  private fun startPrompt(agentId: String, kind: ManifestKind): StartPrompt? {
    val start = StartPrompts.take(agentId) ?: return null
    if (kind.promptsAtStart) return start
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
      prompt = plan.prompt,
    )
    val first = plan.kind.launch(ctx)
    val tui = plan.kind.style == EngineStyle.TUI
    val kitHome = kitHome(plan)
    val built = EngineEnv.build(
      base = System.getenv(),
      image = if (tui) plan.imageEnv + EngineEnv.terminal(TerminalThemes.current) + browser(plan, kitHome) else plan.imageEnv,
      kind = first.env,
      bridgeUrl = bridgeUrl,
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
    val spec = if (carry.isEmpty()) first else plan.kind.launch(ctx.copy(carry = carry))
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
      if (tui) {
        TuiSpawner.spawn(spec.argv, env, cwd, handOver = plan.kind.manifest.type == TYPE_IMAGE)
      } else {
        ServerSpawner.spawn(spec.argv, env, cwd, plan.logFile)
      }
    } catch (e: Exception) {
      TelemetryRecorder.engineStartFailed()
      throw EngineStartException(EngineStartError.START_FAILED, "launch failed: ${e.message ?: e.javaClass.simpleName}")
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
