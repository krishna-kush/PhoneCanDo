package com.phonecando.runner.api

import android.content.Context
import com.phonecando.agents.kit.manifest.VersionCheck
import com.phonecando.agents.kit.render.InstallPlan
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.agents.install.AgentInstalls
import com.phonecando.runner.agents.install.InstallException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// Installing an agent's kind into its image, for JS (engine/agents/install.ts,
// guestEnv.ts): the script for the image's package family, the version
// check, the record of the installed version, and the env names every
// prepareImageForStart passes. All synchronous: rendering reads no image.
// A refusal is a CodedException whose code, also the start of its message,
// is no_recipe or verify_failed. No secret is in any of them.
internal fun ModuleDefinitionBuilder.installFunctions(context: () -> Context) {
  fun installs(): AgentInstalls {
    val ctx = context()
    return AgentInstalls(AgentStores.get(ctx), KindCatalogs.get(ctx))
  }

  Function("guestUnset") { agentId: String ->
    installs().guestUnset(agentId)
  }

  // { script, timeoutSec, phases } | null. Family "" (an image whose
  // family we do not know) has a recipe only for a kind that needs no
  // runtime and no package.
  Function("installPlan") { agentId: String, family: String ->
    coded { installs().installPlan(agentId, family)?.let(::planToJs) }
  }

  Function("updatePlan") { agentId: String, family: String ->
    coded { installs().updatePlan(agentId, family)?.let(::planToJs) }
  }

  // { argv, pattern } | null: argv runs in the image as given.
  Function("versionCheck") { agentId: String ->
    coded { installs().versionCheck(agentId)?.let(::checkToJs) }
  }

  // { version }: the agent's engine may start from now on.
  Function("recordInstall") { agentId: String, versionOutput: String ->
    coded { mapOf("version" to installs().recordInstall(agentId, versionOutput)) }
  }
}

private fun <T> coded(block: () -> T): T = try {
  block()
} catch (e: InstallException) {
  throw CodedException(e.error.code, e.message, e)
}

private fun planToJs(plan: InstallPlan): Map<String, Any?> = mapOf(
  "script" to plan.script,
  "timeoutSec" to plan.timeoutSec,
  "phases" to plan.phases,
)

private fun checkToJs(check: VersionCheck): Map<String, Any?> = mapOf(
  "argv" to check.argv,
  "pattern" to check.pattern,
)
