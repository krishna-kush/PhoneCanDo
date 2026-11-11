package com.phonecando.runner.memory

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineSupervisor
import com.phonecando.runner.notify.AppForeground

// The memory guard's view of the engine supervisor: the engines starting or
// ready, each working or not by its kind's idle rule (as isEngineIdle
// answers JS) and on the model whose server it holds; the model servers
// loading or ready; the agent on screen; and a stop as the user's, with why
// on its status.
internal class EngineMemoryHost(private val context: Context, private val engines: EngineSupervisor) : MemoryGuard.Host {
  private val store = AgentStores.get(context)

  override fun agents(): List<MemoryAgent> {
    val modelOf = engines.loadedModels().flatMap { m -> m.holders.map { it to m.model.id } }.toMap()
    val catalog = KindCatalogs.get(context)
    return engines.statuses()
      .filter { it.state == EngineState.STARTING || it.state == EngineState.READY }
      .map { status ->
        val kind = store.get(status.agentId)?.let { catalog.get(it.kind) }
        val working = kind != null && !engines.isIdle(status.agentId, kind)
        MemoryAgent(status.agentId, null, working, status.lastUsedAt, modelOf[status.agentId])
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
    engines.stopForMemory(agentId)
  }

  override fun name(agentId: String): String? = store.get(agentId)?.name

  private companion object {
    const val TAG = "PhoneCanDoMemory"
  }
}
