package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.acp.AcpAppEvents
import com.phonecando.runner.engine.acp.AcpEngines
import com.phonecando.runner.prompts.PermissionPrompts
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// An agent's ACP turn for JS (the background view on Home; the TS types are
// NativeAcpSnapshot and friends): what it shows now, Stop, and the answer
// to a permission question. What changes is the phonecandoAcp event,
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

  // Answers a permission question: optionId one of the answers it offers,
  // null to cancel it. False when it is gone, the answer is not one it
  // offers, or the agent did not take it.
  Function("resolvePermission") { requestId: String, optionId: String? ->
    PermissionPrompts.resolve(context(), requestId, optionId)
  }
}
