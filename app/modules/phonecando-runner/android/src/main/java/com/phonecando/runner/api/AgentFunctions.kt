package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.agents.AgentKinds
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.notify.AgentNotices
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import kotlin.concurrent.thread

// The agents for JS (records.ts Agent): list, create, rename, delete. The
// password, bridge token and port never leave native code here; JS reads an
// engine's address and password with getEngineAuth when it talks to it.
internal fun ModuleDefinitionBuilder.agentFunctions(context: () -> Context) {
  Function("listAgents") {
    AgentStores.get(context()).all().map(::agentToJs)
  }

  // { kind, name, imageId }; the image must exist (the Linux module makes it).
  Function("createAgent") { params: Map<String, Any?> ->
    val kind = params["kind"] as? String ?: throw IllegalArgumentException("kind is required")
    require(AgentKinds.get(kind) != null) { "unknown agent kind $kind" }
    val name = params["name"] as? String ?: throw IllegalArgumentException("name is required")
    val imageId = params["imageId"] as? String ?: throw IllegalArgumentException("imageId is required")
    agentToJs(AgentStores.get(context()).create(kind, name, imageId))
  }

  Function("renameAgent") { id: String, name: String ->
    agentToJs(AgentStores.get(context()).rename(id, name))
  }

  // Stops the agent's engine first (up to ~3 s, so off the JS thread),
  // then forgets it and takes down its notifications, whose taps would
  // name an agent that is gone. Resolves false for an unknown id. The image
  // stays: JS deletes it through the Linux module.
  AsyncFunction("deleteAgent") { id: String, promise: Promise ->
    val ctx = context()
    thread(name = "phonecando-agent-delete", isDaemon = true) {
      try {
        val engines = Engines.get(ctx)
        engines.stop(id)
        engines.forget(id)
        AgentNotices(ctx).cancelAll(id)
        promise.resolve(AgentStores.get(ctx).delete(id))
      } catch (e: Exception) {
        promise.reject("delete_failed", e.message ?: "delete failed", e)
      }
    }
  }
}

internal fun agentToJs(a: AgentRecord): Map<String, Any?> = mapOf(
  "id" to a.id,
  "kind" to a.kind,
  "name" to a.name,
  "imageId" to a.imageId,
  "createdAt" to a.createdAt.toDouble(),
)
