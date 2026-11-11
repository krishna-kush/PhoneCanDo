package com.phonecando.runner.memory

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import android.util.Log
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.EngineSupervisor
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.proc.ProcScanner
import com.phonecando.runner.models.ModelServer
import com.phonecando.runner.notify.MemoryNotices

// The memory guard bound to this phone, made once with the supervisor
// (Engines): Android's MemoryInfo, our processes in /proc, the
// notifications. It wakes when an engine starts (and with it any model
// server) and when Android reports memory trouble. Android 14+ no longer
// delivers the running-low trim levels or onLowMemory (TelemetryMemoryCallbacks),
// so polling is the real signal there; the callbacks only make older
// phones react sooner.
internal object MemoryGuards {
  private const val TAG = "PhoneCanDoMemory"

  fun install(context: Context, engines: EngineSupervisor, onChange: (MemoryStatus) -> Unit): MemoryGuard {
    val system = SystemMemory(context)
    val scanner = ProcScanner()
    val processes = ProcessMemory()
    val uid = android.os.Process.myUid()
    val pid = android.os.Process.myPid()
    val guard = MemoryGuard(
      host = EngineMemoryHost(context, engines),
      system = system::read,
      owners = { processes.read(scanner.scan(uid), pid, uid, ModelServer.TAG) },
      alerts = MemoryNotices(context),
      onChange = onChange,
      onError = { Log.w(TAG, "memory look failed", it) },
    )
    Engines.addListener(object : Engines.Listener {
      override fun onStatus(status: EngineStatus) {
        if (status.state == EngineState.STARTING) guard.poke()
      }
    })
    context.registerComponentCallbacks(Trim(guard))
    return guard
  }

  // Every trim level but the app leaving the screen gets a look (a cheap one).
  @Suppress("OVERRIDE_DEPRECATION")
  private class Trim(private val guard: MemoryGuard) : ComponentCallbacks2 {
    override fun onTrimMemory(level: Int) {
      if (level != ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) guard.poke()
    }

    override fun onLowMemory() = guard.poke()

    override fun onConfigurationChanged(newConfig: Configuration) {}
  }
}
