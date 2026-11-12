package com.phonecando.runner.memory

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineSupervisor
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.notify.AppForeground
import java.util.concurrent.ConcurrentHashMap

// The memory guard's view of the engine supervisor: the engines starting or
// ready, each working or not by its kind's idle rule (as isEngineIdle
// answers JS), busy or not by the work watch's last look (a job left
// running, Keep running, or its own ask to stay up) and on the model whose
// server it holds; the model servers loading or ready; the agent on
// screen; and a stop as the user's, with why on its status. A stopped
// agent's name says which jobs went with it.
internal class EngineMemoryHost(private val context: Context, private val engines: EngineSupervisor) : MemoryGuard.Host {
  private val store = AgentStores.get(context)

  // Agent id → the jobs it had when we stopped it, for its name in the notice.
  private val stoppedJobs = ConcurrentHashMap<String, List<String>>()

  override fun agents(): List<MemoryAgent> {
    val modelOf = engines.loadedModels().flatMap { m -> m.holders.map { it to m.model.id } }.toMap()
    val catalog = KindCatalogs.get(context)
    val work = Engines.work()?.states().orEmpty()
    return engines.statuses()
      .filter { it.state == EngineState.STARTING || it.state == EngineState.READY }
      .map { status ->
        val kind = store.get(status.agentId)?.let { catalog.get(it.kind) }
        val working = kind != null && !engines.isIdle(status.agentId, kind)
        val busy = work[status.agentId]?.let { it.busy || it.held } == true
        MemoryAgent(status.agentId, null, working, status.lastUsedAt, modelOf[status.agentId], busy)
      }
  }

  override fun models(): List<MemoryModel> = engines.loadedModels().map {
    MemoryModel(it.model.id, it.model.name, null, it.holders.sorted(), it.ready)
  }

  override fun openAgent(): String? = engines.openAgent()

  override fun foreground(): Boolean = AppForeground.isForeground(context)

  override fun anyRunning(): Boolean = engines.anyLive() || engines.loadedModels().isNotEmpty()

  override fun stop(agentId: String) {
    Log.i(TAG, "memory is short, stopping $agentId")
    val jobs = Engines.work()?.states()?.get(agentId)?.jobs.orEmpty()
    if (jobs.isEmpty()) stoppedJobs.remove(agentId) else stoppedJobs[agentId] = jobs
    engines.stopForMemory(agentId)
  }

  // "Claude Code (with npm run dev)" when it had jobs.
  override fun name(agentId: String): String? {
    val name = store.get(agentId)?.name ?: return null
    val jobs = stoppedJobs[agentId] ?: return name
    return "$name (with ${jobs.joinToString(", ")})"
  }

  private companion object {
    const val TAG = "PhoneCanDoMemory"
  }
}
