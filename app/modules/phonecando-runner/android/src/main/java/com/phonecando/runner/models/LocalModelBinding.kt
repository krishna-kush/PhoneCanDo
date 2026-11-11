package com.phonecando.runner.models

import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.api.serve.WireApi
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException

// The one place agents meet local models; neither agents/ nor lme/ knows
// the other. An agent record's `model` (a model id in the store) becomes
// that model's running server (ModelServer, from lme-host's launch plan), whose
// ServedEndpoint becomes the kit's ModelEndpoint; the kind's `models` block
// then picks the wire API (ManifestKind.modelApi) and EngineLauncher hands
// the endpoint to the launch (LaunchContext.model), which renders that
// block's env and args. A kind with no `models`, or none our server
// speaks, is never given a model: its agent is refused with
// model_unavailable rather than started without the model it was set to.
internal class LocalModelBinding(
  private val server: ModelServer,
  /** The ready models in the store (models.json). */
  private val models: () -> List<ModelRecord>,
) {
  /**
   * Refuses at once, before a seat is taken, what cannot work: the kind
   * takes no model, the model is gone, or it is not loaded and the user's
   * cap on loaded models is reached (too_many_models).
   */
  fun check(record: AgentRecord, kind: ManifestKind) {
    val id = record.model ?: return
    if (!accepts(kind)) throw unavailable(ModelReasons.kindTakesNone(kind.displayName))
    if (models().none { it.id == id }) throw unavailable(ModelReasons.gone(id))
    server.checkCap(id)
  }

  /**
   * The model [record]'s engine runs on, its server up and ready (this
   * blocks while the model loads); null for an agent on its own setup.
   * Throws EngineStartException; the agent holds no lease then.
   */
  fun endpoint(record: AgentRecord, kind: ManifestKind): ModelEndpoint? {
    val id = record.model ?: return null
    if (!accepts(kind)) throw unavailable(ModelReasons.kindTakesNone(kind.displayName))
    val model = models().firstOrNull { it.id == id } ?: throw unavailable(ModelReasons.gone(id))
    val endpoint = endpointOf(server.acquire(record.id, model))
    if (kind.modelApi(endpoint.apis) == null) {
      server.release(record.id)
      throw unavailable(ModelReasons.kindTakesNone(kind.displayName))
    }
    return endpoint
  }

  /** The agent's engine is gone: its hold on its model's server ends (the last one stops it). */
  fun release(agentId: String) = server.release(agentId)

  /** The servers that answer now, and who holds each. */
  fun serving(): List<ModelServer.Serving> = server.serving()

  /** Every server loading or ready, and who holds each. */
  fun loaded(): List<ModelServer.Loaded> = server.loaded()

  /** The agents holding [modelId]'s server, also while it loads. */
  fun holders(modelId: String): Set<String> = server.holders(modelId)

  /** Ends [modelId]'s server, also while it loads (stop its agents first); the agents it still held. */
  fun stop(modelId: String): Set<String> = server.stop(modelId)

  fun stopAll() = server.stopAll()

  private fun unavailable(detail: String) = EngineStartException(EngineStartError.MODEL_UNAVAILABLE, detail)

  companion object {
    /** The wire APIs our runtime serves, by the kit's names, in a stable order. */
    val SERVED: List<String> = WireApi.entries.filter { it in LlamaCppRuntime.apis }.map { it.id }

    /** Whether [kind] can run on our model server at all. */
    fun accepts(kind: ManifestKind): Boolean = kind.modelApi(SERVED) != null

    /** lme's endpoint as the kit takes it. */
    fun endpointOf(served: ServedEndpoint): ModelEndpoint = ModelEndpoint(
      baseUrl = served.baseUrl,
      model = served.model,
      key = served.key,
      contextWindow = served.contextWindow.coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
      apis = WireApi.entries.filter { it in served.apis }.map { it.id },
    )
  }
}
