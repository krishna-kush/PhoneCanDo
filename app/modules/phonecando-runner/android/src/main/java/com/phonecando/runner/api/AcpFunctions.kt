package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.acp.AcpAppEvents
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.prompts.AllowAll
import com.phonecando.runner.prompts.PermissionPrompts
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// An agent's ACP turn for JS (the background view on Home; the TS types are
// NativeAcpSnapshot and friends): what it shows now, Stop, and the answer
// to a permission question, and the agent's "Allow everything"
// (prompts/AllowAll). What changes is the phonecandoAcp event,
// through [emit] (AcpAppEvents).
internal fun ModuleDefinitionBuilder.acpFunctions(context: () -> Context, emit: (Map<String, Any?>) -> Unit) {
  AcpAppEvents.sink = emit

  // NativeAcpSnapshot: the agent's chat, whether a turn runs, its items and
  // the open question (by the id resolvePermission takes); null when the
  // agent runs in terminal mode or not at all.
  Function("acpSnapshot") { agentId: String ->
    AcpEngines.of(agentId)?.snapshot()?.toMap()
  }

  // Stops the agent's running ACP turn (session/cancel); false when none runs.
  Function("acpCancel") { agentId: String ->
    val handle = AcpEngines.of(agentId)
    if (handle == null || !handle.busy) return@Function false
    handle.cancel()
    true
  }

  // Keeps [chatId], a chat its ACP mode ran (a scheduled run's), as the
  // one its next terminal launch opens (AgentRecord.acpChat,
  // EngineLauncher.chatToOpen): a tap on that run opens it. False when its
  // kind can't open a chat by id (engine.acp.chat) or there is no such agent.
  Function("keepAcpChat") { agentId: String, chatId: String ->
    val stores = AgentStores.get(context())
    val agent = stores.get(agentId) ?: return@Function false
    if (KindCatalogs.get(context()).get(agent.kind)?.opensChat != true || chatId.isBlank()) return@Function false
    stores.setAcpChat(agentId, chatId)
    true
  }

  // Answers a permission question: optionId one of the answers it offers,
  // null to cancel it. False when it is gone, the answer is not one it
  // offers, or the agent did not take it.
  Function("resolvePermission") { requestId: String, optionId: String? ->
    PermissionPrompts.resolve(context(), requestId, optionId)
  }

  // Whether the agent's "Allow everything" is on.
  Function("allowsAll") { agentId: String ->
    AllowAll.get(context()).isOn(agentId)
  }

  // Returns the switch as kept.
  Function("setAllowsAll") { agentId: String, on: Boolean ->
    val store = AllowAll.get(context())
    store.set(agentId, on)
    store.isOn(agentId)
  }
}
