package com.phonecando.runner.engine.work

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineSupervisor
import com.phonecando.runner.notify.AppForeground

// The work watch's view of the engine supervisor: the engines starting or
// ready, each idle or not by its kind's rule (as isEngineIdle answers JS),
// its quiet time, the user's first input, Keep running, its own ask to
// stay up, a run going and whether its kind raises chat events; the app
// in front; an agent driving the screen; and a stop as the user's.
internal class EngineWorkHost(private val context: Context, private val engines: EngineSupervisor) : WorkWatch.Host {
  private val store = AgentStores.get(context)
  private val keep = KeepRunning.get(context)
  private val asks = KeepAsks.shared

  override fun agents(): List<WorkWatch.Agent> {
    val catalog = KindCatalogs.get(context)
    val working = engines.working()
    return engines.statuses()
      .filter { it.state == EngineState.STARTING || it.state == EngineState.READY }
      .map { status ->
        val kind = store.get(status.agentId)?.let { catalog.get(it.kind) }
        WorkWatch.Agent(
          agentId = status.agentId,
          ready = status.state == EngineState.READY,
          // An agent whose kind is gone: idle, as isEngineIdle answers.
          idle = kind == null || engines.isIdle(status.agentId, kind),
          quietMs = kind?.manifest?.idle?.quietSec?.let { it * 1000L } ?: WorkRules.DEFAULT_QUIET_MS,
          firstInputAt = engines.firstInputAt(status.agentId),
          kept = keep.isOn(status.agentId),
          ask = asks.get(status.agentId),
          running = status.agentId in working,
          reportsChats = kind == null || kind.manifest.events.isNotEmpty(),
        )
      }
  }

  override fun foreground(): Boolean = AppForeground.isForeground(context)

  override fun screenInUse(): Boolean = Bridge.screenInUse()

  override fun stop(agentId: String) {
    Log.i(TAG, "idle in the background with no job left, stopping $agentId")
    engines.stop(agentId)
  }

  private companion object {
    const val TAG = "PhoneCanDoWork"
  }
}
