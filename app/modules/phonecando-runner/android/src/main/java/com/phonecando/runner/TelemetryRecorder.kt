package com.phonecando.runner

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONObject
import java.io.File

// Native half of telemetry, entry point: the once-per-process install and the
// events the service, ServeWatch and the bridge count (src/telemetry.types.ts
// is the contract). Records only, into TelemetryStore; it never does network.
// Beside it: TelemetryStore (the file, its one lock, consume),
// TelemetrySwitch (the user's on/off choice), TelemetryCrashCapture (uncaught
// JVM crashes), TelemetryMemoryCallbacks (low memory) and TelemetrySnapshot
// (what JS reads).
object TelemetryRecorder {
  private const val TAG = "PhoneCanDoTelemetry"

  /** Cap on lastStderrTail, in UTF-8 bytes (tce LIMITS.stderrTail). */
  const val STDERR_TAIL_BYTES = 2048
  private const val MAX_TOOL_KEYS = 64

  @Volatile private var installed = false
  // Generic patterns until install() adds this app's dirs.
  @Volatile private var redactor = PathRedactor.BASE

  // Idempotent; the first call in a process wins. TelemetryInitProvider calls
  // it before Application.onCreate (the earliest hook a library gets, see
  // there); the module's OnCreate and the serve service's onCreate repeat it
  // as fallbacks. Points the store at the app, installs the crash handler and
  // the memory callbacks once per process. Never throws.
  fun install(context: Context) {
    if (installed) return
    synchronized(TelemetryStore.lock) {
      if (installed) return
      val appContext = context.applicationContext ?: context
      TelemetryStore.attach(appContext)
      redactor = try {
        appRedactor(appContext)
      } catch (_: Throwable) {
        PathRedactor.BASE
      }
      try {
        TelemetryCrashCapture.install(appContext, redactor)
      } catch (t: Throwable) {
        Log.w(TAG, "crash handler not installed", t)
      }
      try {
        appContext.registerComponentCallbacks(TelemetryMemoryCallbacks)
      } catch (t: Throwable) {
        Log.w(TAG, "memory callbacks not registered", t)
      }
      installed = true
    }
  }

  // ---- recording -------------------------------------------------------

  /** Real memory pressure (TelemetryMemoryCallbacks). */
  fun lowMemoryTrim() = TelemetryStore.bump(TelemetryStore.K_LOW_MEMORY)

  /** A serve launch was attempted (counted before the attempt). */
  fun engineStartRequested() = TelemetryStore.bump(TelemetryStore.K_STARTS)

  /** The launch threw, or serve never answered health within the boot window. */
  fun engineStartFailed() = TelemetryStore.bump(TelemetryStore.K_START_FAILS)

  /** The preferred port was taken and another was picked. */
  fun portSquat() = TelemetryStore.bump(TelemetryStore.K_PORT_SQUATS)

  /** An engine session was created (engine event stream). */
  fun sessionCreated() = TelemetryStore.bump(TelemetryStore.K_SESSION_CREATES)

  /** Ms from the start request to serve's first healthy answer. */
  fun engineBooted(bootMs: Long) = TelemetryStore.mutate { _, e ->
    e.putLong(TelemetryStore.K_BOOT_MS, bootMs.coerceAtLeast(0L))
  }

  // Serve exited without a stop request, noticed at `diedAt` (epoch ms).
  // `failedBoot`: it never answered health, so the start failed too. The
  // tail must already be redacted (redactedTail); it replaces the previous
  // exit's tail, also with nothing when this exit left none.
  fun engineDied(exitCode: Int, stderrTail: String?, failedBoot: Boolean, diedAt: Long) =
    engineDiedIn(TelemetryStore.prefs(), exitCode, stderrTail, failedBoot, diedAt)

  // engineDied on a given store; internal for the JVM tests (src/test).
  internal fun engineDiedIn(store: SharedPreferences?, exitCode: Int, stderrTail: String?, failedBoot: Boolean, diedAt: Long) =
    TelemetryStore.mutateIn(store) { p, e ->
      e.putInt(TelemetryStore.K_DIED, TelemetryStore.inc(p.getInt(TelemetryStore.K_DIED, 0)))
      if (failedBoot) {
        e.putInt(TelemetryStore.K_START_FAILS, TelemetryStore.inc(p.getInt(TelemetryStore.K_START_FAILS, 0)))
      }
      e.putInt(TelemetryStore.K_EXIT_CODE, exitCode)
      e.putLong(TelemetryStore.K_DIED_AT, diedAt)
      // The tail is engine output that only a user report carries; while sharing
      // is off none is kept, so a report sent after turning it back on never
      // includes output from the off period.
      val sharing = p.getBoolean(TelemetryStore.K_ENABLED, true)
      if (!sharing || stderrTail.isNullOrEmpty()) {
        e.remove(TelemetryStore.K_STDERR_TAIL)
      } else {
        e.putString(TelemetryStore.K_STDERR_TAIL, stderrTail)
      }
    }

  /** One bridge call, keyed by route name (see BridgeServer.TOOL_ROUTES). */
  fun toolCall(name: String) = TelemetryStore.mutate { p, e ->
    val calls = JSONObject(p.getString(TelemetryStore.K_TOOL_CALLS, null) ?: "{}")
    if (calls.has(name) || calls.length() < MAX_TOOL_KEYS) {
      calls.put(name, TelemetryStore.inc(calls.optInt(name, 0)))
      e.putString(TelemetryStore.K_TOOL_CALLS, calls.toString())
    }
  }

  // The serve stderr tail for engineDied: the last ≤ STDERR_TAIL_BYTES of
  // `window` (the end of serve.log; `midFile` when it does not start at the
  // file's first byte), redacted with this app's dirs and `secrets`.
  fun redactedTail(window: ByteArray, midFile: Boolean, secrets: Collection<String>): String? =
    redactor.tail(window, midFile, STDERR_TAIL_BYTES, secrets)

  // This app's home dirs, as given and canonical, on top of the generic
  // storage patterns (PathRedactor.kt). Shared with TelemetryCrashCapture.
  private fun appRedactor(context: Context): PathRedactor {
    val dirs = listOfNotNull(
      runCatching { context.filesDir }.getOrNull(),
      runCatching { context.dataDir }.getOrNull(),
      context.applicationInfo?.dataDir?.let(::File),
    )
    return PathRedactor.forDirs(
      dirs.flatMap { listOfNotNull(it.absolutePath, runCatching { it.canonicalPath }.getOrNull()) },
    )
  }
}
