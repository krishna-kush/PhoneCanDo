package com.phonecando.runner.agents.install

import com.phonecando.agents.kit.manifest.VersionCheck
import com.phonecando.agents.kit.render.GuestEnvPolicy
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.render.InstallPlan
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.agents.kit.render.NoRecipe
import com.phonecando.agents.kit.render.RuntimeBinding
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStore
import com.phonecando.runner.agents.KindCatalog

// What the app needs to install an agent's kind into the agent's image,
// rendered from the kind (kit-render ManifestKind, bound to the runtimes it
// needs), and the record of what that install put there. JS runs the
// script and the check in the image (phonecando-linux) and hands the
// check's output back. In the script {{home}} is $HOME (the image home);
// in the check's argv, which no shell expands, it is GUEST_HOME, where the
// image binds its home and the HOME phonecando-linux runs guest commands
// with. A refusal is an InstallException (no_recipe, verify_failed). Pure.
internal class AgentInstalls(private val agents: AgentStore, private val kinds: KindCatalog) {
  /**
   * The env names the agent's machine keeps from its guests: [machineUnset]
   * of its image, so its launch.conf is the same whichever agent there asks.
   */
  fun guestUnset(agentId: String): List<String> = machineUnset(target(agentId).first.imageId)

  /**
   * What the agents on the machine [imageId] keep from guests, together
   * (kit-render GuestEnvPolicy.union over their kinds, oldest agent first;
   * a kind this build lacks adds none).
   */
  fun machineUnset(imageId: String): List<String> =
    GuestEnvPolicy.union(agents.onMachine(imageId).mapNotNull { kinds.get(it.kind)?.manifest })

  /** The kind's install for the image's [family]; null when the kind has none. */
  fun installPlan(agentId: String, family: String): InstallPlan? = render(agentId) { it.installPlan(family) }

  /** The kind's update steps for [family], its runtimes ensured first; null when it has none. */
  fun updatePlan(agentId: String, family: String): InstallPlan? = render(agentId) { it.updatePlan(family) }

  /**
   * The kind's version check as the image runs it (phonecando-linux runs
   * argv as given and reads stdout only): the guest's sh puts the
   * runtimes' paths first on PATH and execs the check's program ({{home}}
   * filled in) with stderr on stdout, as an image kind's engine starts
   * (ImageLaunch), so a `#!/usr/bin/env node` program finds node, an
   * absolute path runs and a version printed to stderr is read. Null when
   * the kind has none.
   */
  fun versionCheck(agentId: String): VersionCheck? {
    val kind = target(agentId).second
    val check = kind.versionCheck(GUEST_HOME) ?: return null
    val script = ImageLaunch.script(RuntimeBinding.paths(kind.runtimes, GUEST_HOME)) + MERGE_STDERR
    return VersionCheck(listOf(GUEST_SH, "-c", script) + check.argv, check.pattern)
  }

  /**
   * Reads the version from the check's [output] (group 1 of its pattern)
   * and keeps it on the agent and every other agent of its kind on its
   * machine (AgentStore.setInstalledVersion), whose engines may start from
   * then on; a kind
   * without a check records NO_CHECK. Throws verify_failed when the output
   * names no version.
   */
  fun recordInstall(agentId: String, output: String): String {
    val (record, kind) = target(agentId)
    val version = if (kind.manifest.versionCheck == null) {
      NO_CHECK
    } else {
      kind.parseVersion(output)
        ?: throw InstallException(InstallError.VERIFY_FAILED, "no ${kind.displayName} version in the check's output")
    }
    agents.setInstalledVersion(record.id, version)
    return version
  }

  private fun target(agentId: String): Pair<AgentRecord, ManifestKind> {
    val record = agents.get(agentId) ?: throw IllegalArgumentException("unknown agent")
    val kind = kinds.get(record.kind) ?: throw IllegalArgumentException("unknown agent kind ${record.kind}")
    return record to kind
  }

  private fun render(agentId: String, plan: (ManifestKind) -> InstallPlan?): InstallPlan? {
    val kind = target(agentId).second
    return try {
      plan(kind)
    } catch (e: NoRecipe) {
      throw InstallException(InstallError.NO_RECIPE, e.message.orEmpty())
    }
  }

  companion object {
    /** What a kind without a version check records once its install ran. */
    const val NO_CHECK = "installed"

    /** The image home as guest commands see it (lre binds it there). */
    const val GUEST_HOME = ImageLaunch.GUEST_HOME

    /** The guest's own sh, which the image runs through its shim of that name. */
    private const val GUEST_SH = "sh"

    private const val MERGE_STDERR = " 2>&1"
  }
}
