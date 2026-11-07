package com.phonecando.runner.engine

import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.HttpProbe
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.atomic.AtomicBoolean

// One daemon thread per engine process the supervisor launched. During boot
// it polls the kind's health probe with this agent's password: 200 means
// ready (boot time to telemetry); 401 means another engine answers on this
// port, so ours never bound it (onSquatted, the supervisor relaunches on a
// fresh port); no answer within BOOT_TIMEOUT_MS fails the start. Then it
// waits for the process to end. An end nobody asked for (no markStopping()
// first) records the exit code, the time and the redacted tail of the
// engine log, where the process's stdout and stderr go, and reports it.
// It never signals or restarts anything itself.
internal class EngineWatch(
  private val agentId: String,
  private val process: Process,
  private val healthProbe: HttpProbe,
  private val logFile: File,
  /** SystemClock.elapsedRealtime() of the start request. */
  private val requestedAt: Long,
  /** Values replaced with `<secret>` in the tail: every agent's (PathRedactor.agentSecrets). */
  private val secrets: () -> List<String>,
  /** Called on the watch thread, like the callbacks below. */
  private val onHealthy: () -> Unit,
  private val onSquatted: () -> Unit,
  private val onBootTimeout: () -> Unit,
  private val onUnexpectedExit: (code: Int) -> Unit,
) {
  private val stopping = AtomicBoolean(false)

  fun start() {
    Thread({ run() }, "phonecando-engine-watch-$agentId").apply {
      isDaemon = true
      start()
    }
  }

  // The supervisor calls this before it ends the process, so the exit that
  // follows is not counted as a death.
  fun markStopping() {
    stopping.set(true)
  }

  private fun run() {
    try {
      watch()
    } catch (t: Throwable) {
      Log.w(TAG, "engine watch ended", t)
    }
  }

  private fun watch() {
    while (true) {
      exitCode()?.let {
        finish(it, failedBoot = true)
        return
      }
      if (stopping.get()) return
      when (probe()) {
        200 -> {
          TelemetryRecorder.engineBooted(SystemClock.elapsedRealtime() - requestedAt)
          safely(onHealthy)
          break
        }
        401 -> {
          if (!stopping.get()) safely(onSquatted)
          return
        }
      }
      if (SystemClock.elapsedRealtime() - requestedAt >= BOOT_TIMEOUT_MS) {
        if (!stopping.get()) {
          Log.w(TAG, "engine $agentId not healthy after ${BOOT_TIMEOUT_MS}ms")
          TelemetryRecorder.engineStartFailed()
          safely(onBootTimeout)
        }
        return
      }
      try {
        Thread.sleep(PROBE_INTERVAL_MS)
      } catch (_: InterruptedException) {
        return
      }
    }
    val code = try {
      process.waitFor()
    } catch (_: InterruptedException) {
      return
    }
    finish(code, failedBoot = false)
  }

  private fun finish(code: Int, failedBoot: Boolean) {
    if (stopping.get()) return
    Log.w(TAG, "engine $agentId exited without a stop request (code $code)")
    TelemetryRecorder.engineDied(code, stderrTail(), failedBoot, System.currentTimeMillis())
    safely { onUnexpectedExit(code) }
  }

  private fun exitCode(): Int? = try {
    process.exitValue()
  } catch (_: IllegalThreadStateException) {
    null
  }

  // HTTP status, or null while the engine cannot be reached.
  private fun probe(): Int? = try {
    healthProbe.status(PROBE_CONNECT_TIMEOUT_MS, PROBE_READ_TIMEOUT_MS)
  } catch (_: Exception) {
    null
  }

  // Last ≤2 KB (UTF-8) of the engine log, redacted (TelemetryRecorder.redactedTail,
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
      TelemetryRecorder.redactedTail(window, midFile = start > 0, secrets = secrets())
    }
  } catch (_: Exception) {
    null
  }

  private fun safely(block: () -> Unit) {
    try {
      block()
    } catch (t: Throwable) {
      Log.w(TAG, "engine watch callback failed", t)
    }
  }

  companion object {
    private const val TAG = "PhoneCanDoEngineWatch"
    private const val PROBE_INTERVAL_MS = 250L
    private const val PROBE_CONNECT_TIMEOUT_MS = 1_000
    private const val PROBE_READ_TIMEOUT_MS = 3_000
    // A first boot on a slow phone can take a while; past this the start
    // counts as failed and the supervisor stops the engine.
    const val BOOT_TIMEOUT_MS = 120_000L
    // Redaction context before the 2 KB tail: a window that starts mid-line
    // loses only that line's cut-off start.
    private const val READ_WINDOW_BYTES = 16L * 1024
  }
}
