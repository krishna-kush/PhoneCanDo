package com.phonecando.runner

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import kotlin.system.exitProcess

// Uncaught JVM crashes: a default uncaught-exception handler that records
// each crash into TelemetryStore (id, time, class, redacted message and top
// frames, thread, versionName), then always hands it to the handler that was
// there before. Recorded whatever the on/off choice: it stays on the phone,
// and the app drops what it consumes while telemetry is off.
internal object TelemetryCrashCapture {
  private const val MAX_MESSAGE_CHARS = 200
  // A crash message is cut to this before redaction (a JSONException can
  // carry a whole document); cutting the end never hides a path's start.
  private const val MAX_REDACT_CHARS = 16 * 1024
  private const val MAX_FRAMES = 5

  @Volatile private var app: Context? = null
  @Volatile private var versionName = ""
  @Volatile private var redactor = PathRedactor.BASE

  // Once per process, from TelemetryRecorder.install (under the store's
  // lock): keeps what a record needs, then puts the handler in front of the
  // current default one, never twice. The platform calls may throw; the
  // caller logs that.
  fun install(context: Context, redactor: PathRedactor) {
    app = context
    this.redactor = redactor
    versionName = try {
      context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: ""
    } catch (_: Throwable) {
      ""
    }
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    if (previous !is CrashHandler) {
      Thread.setDefaultUncaughtExceptionHandler(CrashHandler(previous))
    }
  }

  // Called from the uncaught-exception handler on the crashing thread; the
  // store writes it with commit(), as the platform kills the process right
  // after.
  private fun recordCrash(thread: Thread, error: Throwable) {
    val p = TelemetryStore.prefs() ?: return
    val secrets = storedEngineSecrets()
    val message = truncateChars(error.message ?: "", MAX_REDACT_CHARS)
    val crash = JSONObject()
      .put("id", UUID.randomUUID().toString())
      .put("ts", System.currentTimeMillis())
      .put("className", error.javaClass.name)
      .put("message", truncateChars(redactor.redact(message, secrets), MAX_MESSAGE_CHARS))
      .put("frames", JSONArray(error.stackTrace.take(MAX_FRAMES).map { redactor.redact(frame(it), secrets) }))
      .put("thread", thread.name ?: "")
      .put("version", versionName)
    TelemetryStore.appendCrash(p, crash)
  }

  // Every agent's engine secrets from the agent store, for a crash
  // message; empty when they cannot be read.
  private fun storedEngineSecrets(): List<String> {
    val context = app ?: return emptyList()
    return try {
      PathRedactor.agentSecrets(AgentStores.get(context).all())
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun frame(e: StackTraceElement): String {
    val line = if (e.lineNumber >= 0) ":${e.lineNumber}" else ""
    return "${e.className}.${e.methodName}(${e.fileName ?: "Unknown Source"}$line)"
  }

  private fun truncateChars(s: String, max: Int): String {
    if (s.length <= max) return s
    var end = max
    if (Character.isHighSurrogate(s[end - 1])) end--
    return s.substring(0, end)
  }

  // Records the crash, then always hands it to the handler that was there
  // before (Android's, which logs it and kills the process; React Native and
  // Expo see it as before). Runs on whichever thread crashed. Nothing here
  // may throw past it: a failed record still delegates.
  private class CrashHandler(
    private val previous: Thread.UncaughtExceptionHandler?,
  ) : Thread.UncaughtExceptionHandler {
    override fun uncaughtException(thread: Thread, error: Throwable) {
      try {
        recordCrash(thread, error)
      } catch (_: Throwable) {
      }
      try {
        if (previous != null) {
          previous.uncaughtException(thread, error)
          return
        }
      } catch (_: Throwable) {
      }
      // No previous handler (never the case on Android), or it threw:
      // die the way the platform handler does, not with a dead thread.
      android.os.Process.killProcess(android.os.Process.myPid())
      exitProcess(10)
    }
  }
}
