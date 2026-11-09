package com.phonecando.runner.engine

import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.ready.ReadyProbe
import java.util.concurrent.atomic.AtomicBoolean

// One daemon thread per engine process the supervisor launched. During boot
// it asks the engine's ReadyProbe: ready goes on (boot time to telemetry);
// squatted means another engine answers on this port, so ours never bound
// it (onSquatted, the supervisor relaunches on a fresh port); not ready
// within the probe's timeout fails the start; an exit before ready may be
// taken over by the supervisor (onBootExit: a relaunch, ResumeFallback),
// which then counts as nothing here. Then it waits for the process to
// end. An end nobody asked for (no markStopping() first) is reported;
// one the kind counts as a death ([isDeath]) also records the exit code,
// the time and the redacted tail of the engine's output (its log, or a
// TUI's screen). It never signals or restarts anything itself.
internal class EngineWatch(
  private val agentId: String,
  private val process: EngineProcess,
  private val ready: ReadyProbe,
  /** SystemClock.elapsedRealtime() of the start request. */
  private val requestedAt: Long,
  /** Values replaced with `<secret>` in the tail: every agent's (PathRedactor.agentSecrets). */
  private val secrets: () -> List<String>,
  /** Whether an exit with this status is a death (a TUI that exits 0 just stopped). */
  private val isDeath: (status: Int) -> Boolean,
  /** Called on the watch thread, like the callbacks below. */
  private val onReady: () -> Unit,
  private val onSquatted: () -> Unit,
  private val onBootTimeout: (timeoutMs: Long) -> Unit,
  /** An exit before ready; true when the supervisor relaunched instead. */
  private val onBootExit: (status: Int) -> Boolean,
  private val onUnexpectedExit: (status: Int) -> Unit,
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
      process.exitStatus()?.let {
        finish(it, failedBoot = true)
        return
      }
      if (stopping.get()) return
      when (ready.check()) {
        ReadyProbe.Verdict.READY -> {
          TelemetryRecorder.engineBooted(SystemClock.elapsedRealtime() - requestedAt)
          safely(onReady)
          break
        }
        ReadyProbe.Verdict.SQUATTED -> {
          if (!stopping.get()) safely(onSquatted)
          return
        }
        ReadyProbe.Verdict.WAIT -> {}
      }
      if (SystemClock.elapsedRealtime() - requestedAt >= ready.timeoutMs) {
        if (!stopping.get()) {
          Log.w(TAG, "engine $agentId not ready after ${ready.timeoutMs}ms")
          TelemetryRecorder.engineStartFailed()
          safely { onBootTimeout(ready.timeoutMs) }
        }
        return
      }
      try {
        Thread.sleep(ready.intervalMs)
      } catch (_: InterruptedException) {
        return
      }
    }
    val status = try {
      process.waitFor()
    } catch (_: InterruptedException) {
      return
    }
    finish(status, failedBoot = false)
  }

  private fun finish(status: Int, failedBoot: Boolean) {
    if (stopping.get()) return
    if (failedBoot && relaunched(status)) return
    if (isDeath(status)) {
      Log.w(TAG, "engine $agentId exited without a stop request (status $status)")
      TelemetryRecorder.engineDied(status, outputTail(), failedBoot, System.currentTimeMillis())
    }
    safely { onUnexpectedExit(status) }
  }

  // Last ≤2 KB (UTF-8) of the engine's output, redacted (TelemetryRecorder.redactedTail,
  // PathRedactor.tail), from a window of at most READ_WINDOW_BYTES; the
  // redactor drops whatever the window's start cut off, so a path or secret
  // split there never slips past redaction.
  private fun outputTail(): String? = try {
    process.outputTail(READ_WINDOW_BYTES)?.let { (window, cut) ->
      TelemetryRecorder.redactedTail(window, midFile = cut, secrets = secrets())
    }
  } catch (_: Exception) {
    null
  }

  private fun relaunched(status: Int): Boolean = try {
    onBootExit(status)
  } catch (t: Throwable) {
    Log.w(TAG, "engine watch callback failed", t)
    false
  }

  private fun safely(block: () -> Unit) {
    try {
      block()
    } catch (t: Throwable) {
      Log.w(TAG, "engine watch callback failed", t)
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoEngineWatch"
    // Redaction context before the 2 KB tail: a window that starts mid-line
    // loses only that line's cut-off start.
    const val READ_WINDOW_BYTES = 16 * 1024
  }
}
