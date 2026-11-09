package com.phonecando.agents.kit.manifest

/**
 * A runtime plugin's runtime.json (schema agents/kit/schema/runtime.schema.json):
 * a language runtime installed into the machine of an agent that needs it
 * (Manifest.runtimes), never into others. It depends on no agent and no
 * other runtime. The licence is CI's and is not modelled.
 */
data class RuntimeManifest(
  val id: String,
  val label: String,
  /** The major version our install scripts put in place. */
  val provides: Int,
  /** The package families it installs on. */
  val families: List<String>,
  /** The install script per family, [PackageFamilies.ANY] the fallback: a path in the plugin folder. */
  val install: Map<String, String>,
  /** Guest folders (templates, {{home}} only) put first on PATH, for the install steps and the engine. */
  val paths: List<String>,
  /** Run before an install: group 1 of its pattern is the major version found. */
  val check: VersionCheck,
) {
  /** The install script's path for [family]; null when the runtime does not install on it. */
  fun scriptFor(family: String): String? =
    if (family !in families) null else install[family] ?: install[PackageFamilies.ANY]
}
