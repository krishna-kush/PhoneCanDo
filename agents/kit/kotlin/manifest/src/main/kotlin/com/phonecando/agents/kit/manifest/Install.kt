package com.phonecando.agents.kit.manifest

/**
 * How an image kind is installed into its machine (`install`): its runtimes
 * first (Manifest.runtimes), then [packages] for the image's family, then
 * [steps]. Each of those that fails runs again, up to [retries] more times
 * (for its runtimes and its update too). A kind without one is not installed.
 */
data class Install(
  /** The families it supports (`install.families`); null: those of its runtimes, or any. */
  val families: List<String>?,
  /** Packages per family, [PackageFamilies.ANY] the fallback, in manifest order. */
  val packages: Map<String, List<String>>,
  /** POSIX sh lines (templates, {{home}} only), run with HOME the image home and the runtimes' paths on PATH. */
  val steps: List<String>,
  /** How long the whole install may run, every attempt included; null: the default. */
  val timeoutSec: Int?,
  /** How many more times a failed runtime script, package install or step runs (0 to [MAX_RETRIES]); null: the default. */
  val retries: Int?,
) {
  /** The packages for [family]: its own list, else the fallback's, else none. */
  fun packagesFor(family: String): List<String> = packages[family] ?: packages[PackageFamilies.ANY].orEmpty()

  companion object {
    /** The most [retries] a manifest may ask for. */
    const val MAX_RETRIES = 5
  }
}

/** The steps that update an installed kind (`update`), run after its runtimes are ensured again. */
data class Update(val steps: List<String>)

/** A program whose output names a version: run [argv] (templates, {{home}} only); group 1 of [pattern] is the version. */
data class VersionCheck(val argv: List<String>, val pattern: String)

/** A runtime a kind needs (`requires.runtimes`): the plugin [id], at least major version [atLeast] when set. */
data class RuntimeNeed(val id: String, val atLeast: Int?) {
  companion object {
    private val FORM = Regex("""([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:>=([1-9][0-9]{0,3}))?""")

    /** `<id>` or `<id>>=<major>`; null when it is neither. */
    fun parse(text: String): RuntimeNeed? =
      FORM.matchEntire(text)?.let { RuntimeNeed(it.groupValues[1], it.groupValues[2].ifEmpty { null }?.toInt()) }
  }
}
