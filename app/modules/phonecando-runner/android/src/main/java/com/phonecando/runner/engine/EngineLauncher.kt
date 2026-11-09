package com.phonecando.runner.engine

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AssetManagerTree
import com.phonecando.runner.agents.ConfigSeeder
import com.phonecando.runner.engine.events.KitFiles
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.engine.image.OsNote
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.spawn.ServerSpawner
import com.phonecando.runner.engine.spawn.TuiSpawner
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
) {
  val logFile: File get() = File(image.logs, "engine.log")
}

// Turns an agent into a running engine process. plan() reads the image
// (engine.env), seeds the kind's config into the image HOME (ConfigSeeder,
// then the image's OS note into the kind's instructions file) and, for a
// TUI engine, the kit scripts and an empty events file (KitFiles); spawn()
// renders the kind's launch (its resume args when the agent ran before; an
// image kind through its image's shell) and starts it with the layered
// environment (EngineEnv) by the kind's engine style: a server from the
// native-library dir, the only place Android lets us exec, with cwd = HOME
// and stdout + stderr in <image>/logs/engine.log (ServerSpawner); a TUI on
// a PTY of its own in its cwd, with what a terminal program needs in its
// env (TuiSpawner).
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
    val image = ImageDir.of(context.filesDir, record.imageId)
    val env = image.readEnv()
    val home = File(env.getValue("HOME")).apply { mkdirs() }
    File(env.getValue("TMPDIR")).mkdirs()
    image.logs.mkdirs()
    seedConfig(kind, home, image)
    if (kind.style == EngineStyle.TUI) seedKit(home)
    return LaunchPlan(record, kind, image, home, env, requestedAt)
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
    )
    val spec = plan.kind.launch(ctx)
    if (counted) TelemetryRecorder.engineStartRequested()
    val binary = File(spec.argv.first())
    if (!binary.exists()) {
      TelemetryRecorder.engineStartFailed()
      throw missing(plan.kind)
    }
    if (!binary.canExecute()) binary.setExecutable(true)
    val tui = plan.kind.style == EngineStyle.TUI
    val kitHome = kitHome(plan)
    val env = EngineEnv.build(
      base = System.getenv(),
      image = if (tui) plan.imageEnv + EngineEnv.TERMINAL + browser(plan, kitHome) else plan.imageEnv,
      kind = spec.env,
      bridgeUrl = bridgeUrl,
      bridgeToken = plan.record.bridgeToken,
      channel = channel,
      agentId = plan.record.id,
      eventsFile = if (tui) KitFiles.events(kitHome).path else null,
    )
    return try {
      if (tui) {
        val cwd = spec.cwd?.let(::File) ?: plan.home
        TuiSpawner.spawn(spec.argv, env, cwd, handOver = plan.kind.manifest.type == TYPE_IMAGE)
      } else {
        ServerSpawner.spawn(spec.argv, env, plan.home, plan.logFile)
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
  // syncAgentConfig task) into its config dir under HOME, pruning files we
  // no longer ship; then the OS note. A failure here never blocks a start.
  private fun seedConfig(kind: AgentKind, home: File, image: ImageDir) {
    val config = kind.config ?: return
    try {
      seeder.seed(config, home)
    } catch (e: Exception) {
      Log.w(TAG, "agent config seed failed", e)
    }
    val instructions = config.instructionsFile ?: return
    try {
      OsNote.apply(File(File(home, config.homeDir), instructions), image.osNote)
    } catch (e: Exception) {
      Log.w(TAG, "os note not written", e)
    }
  }

  // The kit scripts and an empty events file (KitFiles); a TUI that cannot
  // raise events still runs, so a failure here never blocks a start.
  private fun seedKit(home: File) {
    try {
      KitFiles.prepare(assets, home)
    } catch (e: Exception) {
      Log.w(TAG, "kit scripts not seeded", e)
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoEngine"
    const val TYPE_IMAGE = "image"
    const val BROWSER = "BROWSER"
  }
}
