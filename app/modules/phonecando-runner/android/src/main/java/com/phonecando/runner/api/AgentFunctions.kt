package com.phonecando.runner.api

import android.content.Context
import android.util.Log
import com.phonecando.agents.kit.ProjectDir
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCannotShare
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.install.InstallGate
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.image.AgentFiles
import com.phonecando.runner.engine.image.ImageDir
import com.phonecando.runner.engine.image.MachineNotes
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.notify.AgentNotices
import com.phonecando.runner.schedule.Schedules
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import kotlin.concurrent.thread

// The agents for JS (records.ts Agent): list, create, rename, delete (an
// agent's local model: AgentModelFunctions). The password, bridge token
// and port never leave native code here. Agents may share a machine; each
// change rewrites the machine-mates note of every agent on it
// (MachineNotes), and a note that cannot be written never fails the call.
internal fun ModuleDefinitionBuilder.agentFunctions(context: () -> Context) {
  Function("listAgents") {
    val ctx = context()
    AgentStores.get(ctx).all().map { agentToJs(ctx, it) }
  }

  // { kind, name, imageId }; the image must exist (the Linux module makes
  // it). It may hold other agents: a second one of the same kind keeps its
  // own state (ownState) and shares the kind's install there. A kind that
  // cannot keep its own state refuses with kind_cannot_share (the code,
  // also the start of the message).
  Function("createAgent") { params: Map<String, Any?> ->
    val ctx = context()
    val kindId = params["kind"] as? String ?: throw IllegalArgumentException("kind is required")
    val kind = KindCatalogs.get(ctx).get(kindId) ?: throw IllegalArgumentException("unknown agent kind $kindId")
    val name = params["name"] as? String ?: throw IllegalArgumentException("name is required")
    val imageId = params["imageId"] as? String ?: throw IllegalArgumentException("imageId is required")
    val record = try {
      AgentStores.get(ctx).create(kindId, name, imageId, kind.ownStateSupported)
    } catch (e: KindCannotShare) {
      throw CodedException(KindCannotShare.CODE, "${KindCannotShare.CODE}: Two ${kind.displayName} agents can't share a machine", e)
    }
    refreshMachineNotes(ctx, imageId)
    agentToJs(ctx, record)
  }

  Function("renameAgent") { id: String, name: String ->
    val ctx = context()
    val record = AgentStores.get(ctx).rename(id, name)
    refreshMachineNotes(ctx, record.imageId)
    agentToJs(ctx, record)
  }

  // Stops the agent's engine first (up to ~3 s, so off the JS thread),
  // then forgets it and takes down its notifications, whose taps would
  // name an agent that is gone, drops the messages to it (Messages; the log
  // keeps what it sent) and its schedules (Schedules), and removes what it
  // alone kept on its machine (AgentFiles: its state folder, events file,
  // inbox folder and engine log;
  // when it kept its state where its kind does and other agents stay on
  // the machine, its kind's user state there, so the next agent of the
  // kind starts clean). Resolves false for an unknown id. The image always
  // stays, whatever else is on it: JS deletes it with its last agent,
  // through the Linux module.
  AsyncFunction("deleteAgent") { id: String, promise: Promise ->
    val ctx = context()
    thread(name = "phonecando-agent-delete", isDaemon = true) {
      try {
        val engines = Engines.get(ctx)
        engines.stop(id)
        engines.forget(id)
        AgentNotices(ctx).cancelAll(id)
        Messages.get(ctx).forget(id)
        Schedules.get(ctx).forget(id)
        val store = AgentStores.get(ctx)
        val record = store.get(id)
        val deleted = store.delete(id)
        if (record != null && deleted) {
          try {
            val machineStays = store.onMachine(record.imageId).isNotEmpty()
            val kind = KindCatalogs.get(ctx).get(record.kind)
            val left = AgentFiles.remove(ImageDir.of(ctx.filesDir, record.imageId), record, kind, machineStays)
            if (left.isNotEmpty()) Log.w(TAG, "agent ${record.id}: ${left.size} of its files not removed (${left.joinToString { it.name }})")
          } catch (e: Exception) {
            Log.w(TAG, "files of agent ${record.id} not removed", e)
          }
          refreshMachineNotes(ctx, record.imageId)
        }
        promise.resolve(deleted)
      } catch (e: Exception) {
        promise.reject("delete_failed", e.message ?: "delete failed", e)
      }
    }
  }
}

// Who is on the machine, in every agent's instructions there (MachineNotes).
private fun refreshMachineNotes(context: Context, imageId: String) {
  try {
    val notes = MachineNotes(AgentStores.get(context), KindCatalogs.get(context)::get)
    notes.refresh(imageId, ImageDir.of(context.filesDir, imageId).home) { agent, e ->
      Log.w(TAG, "machine note for ${agent.id} not written", e)
    }
  } catch (e: Exception) {
    Log.w(TAG, "machine notes not written", e)
  }
}

private const val TAG = "PhoneCanDoAgents"

// needsInstall: its kind installs into its image and no install is
// recorded (InstallGate); an agent of a kind this build lacks needs none.
// ownState: it keeps its state in a folder of its own on its machine.
// wakeable: other agents' messages may wake it (messages/).
// projectDir: the work folder in its image's home/ (ProjectDir), host path.
internal fun agentToJs(context: Context, a: AgentRecord): Map<String, Any?> = mapOf(
  "id" to a.id,
  "kind" to a.kind,
  "name" to a.name,
  "imageId" to a.imageId,
  "projectDir" to ProjectDir.of(ImageDir.of(context.filesDir, a.imageId).home).path,
  "createdAt" to a.createdAt.toDouble(),
  "installedVersion" to a.installedVersion,
  "model" to a.model,
  "ownState" to a.ownState,
  "wakeable" to a.wakeable,
  "needsInstall" to (KindCatalogs.get(context).get(a.kind)?.let { InstallGate.needsInstall(it, a) } == true),
)
