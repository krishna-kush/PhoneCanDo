package com.phonecando.agents.kit.manifest

// What a user-added kind may be, checked on the phone because its manifest
// never went through our CI (the kit's TS validator has the same rules for
// origin user): an `user.` id, an image kind whose engine is its own TUI and
// which needs Linux and is never the default; no code hooks, no native
// payload, no config packaged from assets (`config.dir`, `overlay`,
// `shared`) and no web surface; no env name the host sets (RESERVED_ENV);
// install steps and update steps of at most MAX_SCRIPT_BYTES each. Each
// break throws ManifestException at the JSON pointer of the offending value.
internal object UserRules {
  const val ID_PREFIX = "user."

  /** The most UTF-8 bytes a user kind's install steps, or its update steps, hold, joined by newlines. */
  const val MAX_SCRIPT_BYTES = 32 * 1024

  // The host's env names (every engine's) and PATH, which an image kind's
  // launch builds from its runtimes.
  private val RESERVED_ENV = Regex("PHONECANDO_.*|LD_.*|HOME|TMPDIR|PATH")

  fun check(m: JsonFields, manifest: Manifest) {
    if (!manifest.id.startsWith(ID_PREFIX)) fail(m.at("id"), "a user kind's id starts with $ID_PREFIX")
    if (manifest.type != "image") fail(m.at("type"), "a user kind is an image kind")
    val engine = m.optObj("engine") ?: fail(m.at("engine"), "is required")
    if (manifest.engine?.style != EngineStyle.TUI) fail(engine.at("style"), "a user kind's engine is its TUI (tui)")
    if (manifest.linux != LinuxNeed.REQUIRED) fail("${m.at("requires")}/linux", "a user kind needs Linux (required)")
    for (key in listOf("hooks", "payload")) if (m.has(key)) fail(m.at(key), "a user kind has none")
    if (m.has("default")) fail(m.at("default"), "a user kind is never the default")
    m.optObj("config")?.let { c ->
      for (key in listOf("dir", "overlay", "shared")) if (c.has(key)) fail(c.at(key), "a user kind packages no config")
    }
    m.optObj("surfaces")?.let { s ->
      if (s.has("web")) fail(s.at("web"), "a user kind has no web surface")
      if (manifest.surfaces?.home != HomeSurface.TUI) fail(s.at("home"), "a user kind's Home is its TUI (tui)")
    }
    val env = engine.optObj("launch")?.optObj("env")
    manifest.engine?.launch?.env?.keys?.firstOrNull(RESERVED_ENV::matches)?.let { name ->
      fail(env!!.at(name), "$name is the host's to set")
    }
    script(m, "install", manifest.install?.steps)
    script(m, "update", manifest.update?.steps)
  }

  private fun script(m: JsonFields, block: String, steps: List<String>?) {
    if (steps == null || steps.joinToString("\n").toByteArray(Charsets.UTF_8).size <= MAX_SCRIPT_BYTES) return
    fail("${m.at(block)}/steps", "a user kind's $block steps are at most ${MAX_SCRIPT_BYTES / 1024} KiB")
  }

  private fun fail(path: String, detail: String): Nothing = throw ManifestException(path, detail)
}
