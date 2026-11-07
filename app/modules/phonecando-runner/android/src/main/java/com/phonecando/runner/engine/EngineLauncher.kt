package com.phonecando.runner.engine

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AssetManagerTree
import com.phonecando.runner.agents.ConfigSeeder
import com.phonecando.runner.agents.LaunchContext
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.engine.image.OsNote
import java.io.File

/** What one launch of an agent's engine needs; kept for a relaunch on a fresh port. */
internal data class LaunchPlan(
  val record: AgentRecord,
  val kind: AgentKind,
  val image: ImageDir,
  val home: File,
  /** The image's engine.env, with HOME and TMPDIR set. */
  val imageEnv: Map<String, String>,
  /** SystemClock.elapsedRealtime() of the start request (boot time). */
  val requestedAt: Long,
) {
  val logFile: File get() = File(image.logs, "engine.log")
}

// Turns an agent into a running engine process. plan() reads the image
// (engine.env), seeds the kind's config into the image HOME (ConfigSeeder,
// then the image's OS note into the kind's instructions file); spawn()
// starts the kind's argv from the native-library dir, the only place
// Android lets us exec, with cwd = HOME, the layered environment
// (EngineEnv) and stdout + stderr in <image>/logs/engine.log.
internal class EngineLauncher(private val context: Context) {
  private val libDir: String = context.applicationInfo.nativeLibraryDir
  private val seeder by lazy { ConfigSeeder(AssetManagerTree(context.assets)) }

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
  fun plan(record: AgentRecord, kind: AgentKind, requestedAt: Long): LaunchPlan {
    val image = ImageDir.of(context.filesDir, record.imageId)
    val env = image.readEnv()
    val home = File(env.getValue("HOME")).apply { mkdirs() }
    File(env.getValue("TMPDIR")).mkdirs()
    image.logs.mkdirs()
    seedConfig(kind, home, image)
    return LaunchPlan(record, kind, image, home, env, requestedAt)
  }

  /** Throws engine_missing or start_failed; counts the attempt for telemetry. */
  fun spawn(plan: LaunchPlan, port: Int, bridgeUrl: String?): Process {
    val spec = plan.kind.launch(LaunchContext(libDir, plan.home, port.toString(), plan.record.password))
    TelemetryRecorder.engineStartRequested()
    val binary = File(spec.argv.first())
    if (!binary.exists()) {
      TelemetryRecorder.engineStartFailed()
      throw EngineStartException(EngineStartError.ENGINE_MISSING, "${plan.kind.displayName} is not in this build")
    }
    if (!binary.canExecute()) binary.setExecutable(true)
    val env = EngineEnv.build(
      base = System.getenv(),
      image = plan.imageEnv,
      kind = spec.env,
      bridgeUrl = bridgeUrl,
      bridgeToken = plan.record.bridgeToken,
      channel = channel,
      agentId = plan.record.id,
    )
    return try {
      val pb = ProcessBuilder(spec.argv)
        .directory(plan.home)
        .redirectErrorStream(true)
        .redirectOutput(plan.logFile)
      pb.environment().apply {
        clear()
        putAll(env)
      }
      pb.start()
    } catch (e: Exception) {
      TelemetryRecorder.engineStartFailed()
      throw EngineStartException(EngineStartError.START_FAILED, "launch failed: ${e.message ?: e.javaClass.simpleName}")
    }
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

  private companion object {
    const val TAG = "PhoneCanDoEngine"
  }
}
