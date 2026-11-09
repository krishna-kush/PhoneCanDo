package com.phonecando.agents.kit.manifest

// What a user-added kind may be, checked on the phone because its manifest
// never went through our CI (the kit's TS validator has the same rules for
// origin user): an `user.` id, an image kind whose engine is its own TUI and
// which needs Linux; no code hooks, no native payload, no config packaged
// from assets (`config.dir`, `overlay`, `shared`) and no web surface. Each
// break throws ManifestException at the JSON pointer of the offending value.
internal object UserRules {
  const val ID_PREFIX = "user."

  fun check(m: JsonFields, manifest: Manifest) {
    if (!manifest.id.startsWith(ID_PREFIX)) fail(m.at("id"), "a user kind's id starts with $ID_PREFIX")
    if (manifest.type != "image") fail(m.at("type"), "a user kind is an image kind")
    val engine = m.optObj("engine") ?: fail(m.at("engine"), "is required")
    if (manifest.engine?.style != EngineStyle.TUI) fail(engine.at("style"), "a user kind's engine is its TUI (tui)")
    if (manifest.linux != LinuxNeed.REQUIRED) fail("${m.at("requires")}/linux", "a user kind needs Linux (required)")
    for (key in listOf("hooks", "payload")) if (m.has(key)) fail(m.at(key), "a user kind has none")
    m.optObj("config")?.let { c ->
      for (key in listOf("dir", "overlay", "shared")) if (c.has(key)) fail(c.at(key), "a user kind packages no config")
    }
    m.optObj("surfaces")?.let { s ->
      if (s.has("web")) fail(s.at("web"), "a user kind has no web surface")
      if (manifest.surfaces?.home != HomeSurface.TUI) fail(s.at("home"), "a user kind's Home is its TUI (tui)")
    }
  }

  private fun fail(path: String, detail: String): Nothing = throw ManifestException(path, detail)
}
