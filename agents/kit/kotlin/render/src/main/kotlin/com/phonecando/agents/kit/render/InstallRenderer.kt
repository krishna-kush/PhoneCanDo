package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Manifest

// A kind's install, and its update, as one guest script per image family
// (InstallScript): its runtimes (`runtime:<id>`, each skipped when its check
// already passes), then the family's packages (`packages`), then the steps
// (`install`, or `update`), then the version check's program (`verify`; the
// host reads the version from its output with VersionParse). A kind without
// an install has nothing to install or update. The family must be one the
// kind and every runtime it needs install on. The script runs with HOME the
// image home, and {{home}} is ${HOME} in it. Each runtime's script, the
// packages (the index refresh and the install together) and each step runs
// again when it fails, up to `install.retries` more times (InstallScript:
// `@retry` lines, a growing wait); the version check runs once.
object InstallRenderer {
  const val DEFAULT_TIMEOUT_SEC = 1200

  /** How many more times a failed unit runs when the manifest does not say (`install.retries`). */
  const val DEFAULT_RETRIES = 2

  /** The install for [family]; null when the kind has none. Throws NoRecipe when the family is not supported. */
  fun plan(manifest: Manifest, runtimes: List<BoundRuntime>, family: String): InstallPlan? {
    val install = manifest.install ?: return null
    val script = start(manifest, runtimes, family)
    val packages = install.packagesFor(family)
    if (packages.isNotEmpty()) {
      val lines = PackageCommands.lines(family, ShellQuote.words(packages))
        ?: throw NoRecipe(manifest.id, family, RuntimeBinding.families(manifest, runtimes))
      script.phase(PHASE_PACKAGES)
      script.retried(lines)
    }
    if (install.steps.isNotEmpty()) {
      script.phase(PHASE_INSTALL)
      install.steps.forEach { script.retried(listOf(it)) }
    }
    return finish(manifest, script)
  }

  /** The update for [family], its runtimes ensured again first; null when the kind has no install or no update. */
  fun updatePlan(manifest: Manifest, runtimes: List<BoundRuntime>, family: String): InstallPlan? {
    if (manifest.install == null) return null
    val update = manifest.update ?: return null
    val script = start(manifest, runtimes, family)
    script.phase(PHASE_UPDATE)
    update.steps.forEach { script.retried(listOf(it)) }
    return finish(manifest, script)
  }

  private fun start(manifest: Manifest, runtimes: List<BoundRuntime>, family: String): InstallScript {
    val families = RuntimeBinding.families(manifest, runtimes)
    if (families != null && family !in families) throw NoRecipe(manifest.id, family, families)
    val attempts = (manifest.install?.retries ?: DEFAULT_RETRIES) + 1
    val script = InstallScript(manifest.id, runtimes.flatMap { it.plugin.manifest.paths }.distinct(), attempts)
    for (runtime in runtimes) {
      script.runtime(runtime, runtime.plugin.script(family) ?: throw NoRecipe(manifest.id, family, families))
    }
    return script
  }

  private fun finish(manifest: Manifest, script: InstallScript): InstallPlan {
    manifest.versionCheck?.let { check ->
      script.phase(PHASE_VERIFY)
      script.command(check.argv)
    }
    return script.finish(manifest.install?.timeoutSec ?: DEFAULT_TIMEOUT_SEC)
  }

  private const val PHASE_PACKAGES = "packages"
  private const val PHASE_INSTALL = "install"
  private const val PHASE_UPDATE = "update"
  private const val PHASE_VERIFY = "verify"
}
