package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.install.InstallGate
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.notify.AgentNotices
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import kotlin.concurrent.thread

// The agents for JS (records.ts Agent): list, create, rename, delete. The
// password, bridge token and port never leave native code here.
internal fun ModuleDefinitionBuilder.agentFunctions(context: () -> Context) {
  Function("listAgents") {
    val ctx = context()
    AgentStores.get(ctx).all().map { agentToJs(ctx, it) }
  }

  // { kind, name, imageId }; the image must exist (the Linux module makes it).
  Function("createAgent") { params: Map<String, Any?> ->
    val ctx = context()
    val kind = params["kind"] as? String ?: throw IllegalArgumentException("kind is required")
    require(KindCatalogs.get(ctx).get(kind) != null) { "unknown agent kind $kind" }
    val name = params["name"] as? String ?: throw IllegalArgumentException("name is required")
    val imageId = params["imageId"] as? String ?: throw IllegalArgumentException("imageId is required")
    agentToJs(ctx, AgentStores.get(ctx).create(kind, name, imageId))
  }

  Function("renameAgent") { id: String, name: String ->
    val ctx = context()
    agentToJs(ctx, AgentStores.get(ctx).rename(id, name))
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

// needsInstall: its kind installs into its image and no install is
// recorded (InstallGate); an agent of a kind this build lacks needs none.
internal fun agentToJs(context: Context, a: AgentRecord): Map<String, Any?> = mapOf(
  "id" to a.id,
  "kind" to a.kind,
  "name" to a.name,
  "imageId" to a.imageId,
  "createdAt" to a.createdAt.toDouble(),
  "installedVersion" to a.installedVersion,
  "needsInstall" to (KindCatalogs.get(context).get(a.kind)?.let { InstallGate.needsInstall(it, a) } == true),
)
