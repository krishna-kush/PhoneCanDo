package com.phonecando.runner

import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.agents.HttpProbe
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.atomic.AtomicBoolean

// Engine health for telemetry: one daemon thread per serve process the
// service launched. It measures the boot (start request to serve's first
// healthy answer to the kind's health probe, the same request as the
// module's `health`), then waits for the process to end. An end nobody asked
// for (no markStopping() first) records the exit code, the time and the
// redacted tail of serve.log, where the service already sends serve's stdout
// and stderr.
// It only observes: it never restarts, signals or reads serve's pipes, and
// its only traffic is that loopback probe to our own child during boot.
internal class ServeWatch(
  private val process: Process,
  /** AgentKind.healthProbe; null while the password is unknown (never healthy). */
  private val healthProbe: HttpProbe?,
  private val logFile: File,
  /** SystemClock.elapsedRealtime() of the start request. */
  private val requestedAt: Long,
  /** Values replaced with `<secret>` in the tail (PathRedactor.engineSecrets). */
  private val secrets: List<String>,
  /** Serve answered health for the first time. Called on the watch thread. */
  private val onHealthy: () -> Unit,
  /** Serve exited without a stop request. Called on the watch thread. */
  private val onUnexpectedExit: () -> Unit,
) {
  private val stopping = AtomicBoolean(false)

  fun start() {
    Thread({ run() }, "phonecando-serve-watch").apply {
      isDaemon = true
      start()
    }
  }

  // The service calls this before it destroys the process, so the exit that
  // follows is not counted as a death.
  fun markStopping() {
    stopping.set(true)
  }

  private fun run() {
    try {
      watch()
    } catch (t: Throwable) {
      Log.w(TAG, "serve watch ended", t)
    }
  }

  private fun watch() {
    // Boot is settled once serve answered health or the boot window closed.
    var bootSettled = false
    while (true) {
      exitCode()?.let {
        finish(it, failedBoot = !bootSettled)
        return
      }
      if (stopping.get()) return
      if (!bootSettled) {
        if (healthy()) {
          bootSettled = true
          TelemetryRecorder.engineBooted(SystemClock.elapsedRealtime() - requestedAt)
          safely(onHealthy)
        } else if (SystemClock.elapsedRealtime() - requestedAt >= BOOT_TIMEOUT_MS) {
          bootSettled = true
          if (!stopping.get()) {
            Log.w(TAG, "serve not healthy after ${BOOT_TIMEOUT_MS}ms")
            TelemetryRecorder.engineStartFailed()
          }
        }
      }
      if (bootSettled) {
        val code = try {
          process.waitFor()
        } catch (_: InterruptedException) {
          return
        }
        finish(code, failedBoot = false)
        return
      }
      try {
        Thread.sleep(PROBE_INTERVAL_MS)
      } catch (_: InterruptedException) {
        return
      }
    }
  }

  private fun finish(code: Int, failedBoot: Boolean) {
    if (stopping.get()) return
    val diedAt = System.currentTimeMillis()
    Log.w(TAG, "serve exited without a stop request (code $code)")
    TelemetryRecorder.engineDied(code, stderrTail(), failedBoot, diedAt)
    safely(onUnexpectedExit)
  }

  private fun exitCode(): Int? = try {
    process.exitValue()
  } catch (_: IllegalThreadStateException) {
    null
  }

  private fun healthy(): Boolean {
    val probe = healthProbe ?: return false
    return try {
      probe.status(PROBE_CONNECT_TIMEOUT_MS, PROBE_READ_TIMEOUT_MS) == 200
    } catch (_: Exception) {
      false
    }
  }

  // Last ≤2 KB (UTF-8) of serve.log, redacted (TelemetryRecorder.redactedTail,
  // PathRedactor.tail). Reads at most READ_WINDOW_BYTES, however long the
  // file or its lines; the redactor drops whatever the window's start cut
  // off, so a path or secret split there never slips past redaction.
  private fun stderrTail(): String? = try {
    RandomAccessFile(logFile, "r").use { f ->
      val len = f.length()
      val start = maxOf(0L, len - READ_WINDOW_BYTES)
      val window = ByteArray((len - start).toInt())
      f.seek(start)
      f.readFully(window)
      TelemetryRecorder.redactedTail(window, midFile = start > 0, secrets = secrets)
    }
  } catch (_: Exception) {
    null
  }

  private fun safely(block: () -> Unit) {
    try {
      block()
    } catch (t: Throwable) {
      Log.w(TAG, "serve watch callback failed", t)
    }
  }

  companion object {
    private const val TAG = "PhoneCanDoServeWatch"
    private const val PROBE_INTERVAL_MS = 250L
    private const val PROBE_CONNECT_TIMEOUT_MS = 1_000
    private const val PROBE_READ_TIMEOUT_MS = 3_000
    // A first boot on a slow phone can take a while; past this the start
    // counts as failed (a later death is still counted as died).
    private const val BOOT_TIMEOUT_MS = 120_000L
    // Redaction context before the 2 KB tail: a window that starts mid-line
    // loses only that line's cut-off start.
    private const val READ_WINDOW_BYTES = 16L * 1024
  }
}
