package com.phonecando.runner.api

import android.content.Context
import com.phonecando.models.ModelsHost
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.models.LocalModelBinding
import com.phonecando.runner.models.ModelReasons
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import kotlin.concurrent.thread

// An agent's local model for JS (records.ts Agent.model), and the model
// server reading a prompt (src/engine/models/promptReading.ts). The model
// ids come from the models module (app/src/engine/models/).
internal fun ModuleDefinitionBuilder.agentModelFunctions(context: () -> Context) {
  // The prompt the model server is reading for a bound agent's run
  // (PromptReading.toMap), null when none; changes come as the
  // phonecandoPromptReading event.
  Function("promptReading") {
    Engines.peek()?.promptReading()?.toMap()
  }

  // Sets the model the agent runs on (a model on the phone), or null for
  // its own setup. A starting or running engine is stopped first (up to
  // ~3 s, so off the JS thread); resolves { wasRunning, agent } and JS
  // starts it again (it prepares the image first). Rejects
  // model_unavailable for a kind that takes no local model or a model that
  // is not on the phone.
  AsyncFunction("setAgentModel") { agentId: String, modelId: String?, promise: Promise ->
    val ctx = context()
    thread(name = "phonecando-agent-model", isDaemon = true) {
      try {
        val store = AgentStores.get(ctx)
        val record = store.get(agentId) ?: throw IllegalArgumentException("unknown agent")
        if (modelId != null) {
          val kind = KindCatalogs.get(ctx).get(record.kind) ?: throw IllegalArgumentException("unknown agent kind ${record.kind}")
          if (!LocalModelBinding.accepts(kind)) throw unavailable(ModelReasons.kindTakesNone(kind.displayName))
          if (ModelsHost.get(ctx).store.models().none { it.id == modelId }) throw unavailable(ModelReasons.gone(modelId))
        }
        val engines = Engines.get(ctx)
        val state = engines.status(agentId).state
        val wasRunning = state == EngineState.STARTING || state == EngineState.READY
        if (record.model != modelId && wasRunning) engines.stop(agentId)
        val updated = if (record.model == modelId) record else store.setModel(agentId, modelId)
        promise.resolve(mapOf("wasRunning" to wasRunning, "agent" to agentToJs(ctx, updated)))
      } catch (e: EngineStartException) {
        promise.reject(e.error.code, e.message, e)
      } catch (e: Exception) {
        promise.reject("set_model_failed", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }

  // Stops every agent set to the model whose engine is starting or ready
  // (one grace for all; the model server goes with the last), so a change
  // to the model's context takes effect: resolves their ids, and JS starts
  // them again as after setAgentModel.
  AsyncFunction("stopModelAgents") { modelId: String, promise: Promise ->
    val ctx = context()
    thread(name = "phonecando-model-agents", isDaemon = true) {
      try {
        val engines = Engines.get(ctx)
        val running = AgentStores.get(ctx).all()
          .filter { it.model == modelId }
          .map { it.id }
          .filter { engines.status(it).state.let { s -> s == EngineState.STARTING || s == EngineState.READY } }
        if (running.isNotEmpty()) engines.stop(running.toSet())
        promise.resolve(running)
      } catch (e: Exception) {
        promise.reject("stop_failed", e.message ?: e.javaClass.simpleName, e)
      }
    }
  }
}

private fun unavailable(detail: String) = EngineStartException(EngineStartError.MODEL_UNAVAILABLE, detail)
