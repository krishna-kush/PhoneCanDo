package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.checks.CapabilityView
import com.phonecando.runner.checks.Checks
import com.phonecando.runner.checks.fanout.ChecksEvents
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.checks.now.CheckNowRules
import com.phonecando.runner.checks.now.model.CheckModel
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// An agent's capability checks for JS (the agent page; the TS types are
// NativeAgentChecks and friends): each capability as it reads now, the
// messaging level that works now, its last Check now, Check now itself
// and its Cancel. What changes is the phonecandoChecks event, {agentId},
// through [emit] (ChecksEvents).
internal fun ModuleDefinitionBuilder.checksFunctions(context: () -> Context, emit: (Map<String, Any?>) -> Unit) {
  ChecksEvents.sink = emit

  // NativeAgentChecks: {capabilities: [{id, state, cliVersion?, at?, code?,
  // detail?}], levelNow, run: NativeCheckRun (CheckRun.toMap) | null,
  // checkNow, checkNowWhy?, parts}; null for an agent (or kind) we don't
  // know.
  Function("agentChecks") { agentId: String ->
    agentChecks(context(), agentId)
  }

  // Every kind's messaging level now, by kind id.
  Function("kindLevels") {
    Checks.init(context())
    KindCatalogs.get(context()).all().associate { it.id to Checks.levelNow(it).wire }
  }

  // Check now: null when its task started, else why not.
  // Check now: every capability when full, else only those not checked yet.
  Function("checkNow") { agentId: String, full: Boolean ->
    CheckNow.start(context(), agentId, full)
  }

  // Cancel check: its engine stops; false when no check of it runs.
  Function("checkCancel") { agentId: String ->
    CheckNow.cancel(context(), agentId)
  }
}

private fun agentChecks(context: Context, agentId: String): Map<String, Any?>? {
  val agent = AgentStores.get(context).get(agentId)
  if (agent == null) {
    CheckNow.forget(agentId)
    return null
  }
  val kind = KindCatalogs.get(context).get(agent.kind) ?: return null
  // The JS module can be up before the service that loads them.
  Checks.init(context)
  val why = CheckNowRules.kindRefusal(kind.promptsAtStart, kind.speaksAcp)
  return buildMap {
    put("capabilities", Checks.view(kind, agent).map(::capabilityMap))
    put("levelNow", Checks.levelNow(kind).wire)
    put("run", CheckNow.run(agentId)?.toMap())
    put("checkNow", why == null)
    why?.let { put("checkNowWhy", it) }
    put("parts", CheckNow.parts(kind))
    // What Check the rest would run: its parts and the ids it tests; null: nothing left it can test.
    put("rest", CheckNow.rest(kind, agent)?.let { plan -> mapOf("parts" to plan.parts.size, "ids" to plan.parts.flatMap { it.tests }) })
    // Check now runs it on the check model, not its own.
    put("checkModel", CheckModel.takes(kind))
  }
}

private fun capabilityMap(view: CapabilityView): Map<String, Any?> = buildMap {
  put("id", view.capability.wire)
  put("state", view.state.wire)
  view.cliVersion?.let { put("cliVersion", it) }
  view.at?.let { put("at", it) }
  view.code?.let { put("code", it) }
  view.detail?.let { put("detail", it) }
}
