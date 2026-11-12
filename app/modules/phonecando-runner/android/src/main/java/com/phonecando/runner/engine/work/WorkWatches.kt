package com.phonecando.runner.engine.work

import android.content.Context
import android.os.Process
import android.os.SystemClock
import android.system.Os
import android.system.OsConstants
import android.util.Log
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.EngineSupervisor
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.proc.DetailScanner
import com.phonecando.runner.engine.proc.ProcFields
import java.io.File

// The work watch bound to this phone, made once with the supervisor
// (Engines): our processes in /proc, clock ticks at the kernel's rate,
// process starts against elapsedRealtime (which a check at install logs),
// logcat for its verdicts. It wakes when an engine starts.
internal object WorkWatches {
  private const val TAG = "PhoneCanDoWork"

  fun install(context: Context, engines: EngineSupervisor, onLook: (Boolean) -> Unit): WorkWatch {
    val hz = runCatching { Os.sysconf(OsConstants._SC_CLK_TCK) }.getOrNull()?.takeIf { it > 0 } ?: 100L
    val scanner = DetailScanner(hz = hz, sinceBoot = SystemClock::elapsedRealtime)
    val uid = Process.myUid()
    val pid = Process.myPid()
    checkClock(hz)
    val watch = WorkWatch(
      host = EngineWorkHost(context, engines),
      scan = { scanner.scan(uid, pid) },
      writers = scanner::pipeWriters,
      onLook = onLook,
      log = { Log.i(TAG, it) },
      onError = { Log.w(TAG, "work look failed", it) },
    )
    Engines.addListener(object : Engines.Listener {
      override fun onStatus(status: EngineStatus) {
        if (status.state == EngineState.STARTING) watch.poke()
      }
    })
    return watch
  }

  // A process's start in /proc is ticks since boot; we read it against
  // elapsedRealtime, which counts deep sleep. Kernels before 5.x count
  // without it: then the two part, and a log says by how much.
  private fun checkClock(hz: Long) {
    try {
      val ticks = ProcFields.parseStat(File("/proc/self/stat").readText())?.startTicks ?: return
      val drift = ticks * 1000L / hz - Process.getStartElapsedRealtime()
      Log.i(TAG, "[phonecando-work] clock check: /proc start minus elapsedRealtime start = $drift ms")
    } catch (e: Exception) {
      Log.w(TAG, "clock check failed", e)
    }
  }
}
