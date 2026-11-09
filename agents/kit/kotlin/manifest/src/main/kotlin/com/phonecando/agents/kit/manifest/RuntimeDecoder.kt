package com.phonecando.agents.kit.manifest

// runtime.json text -> RuntimeManifest. Strict about the structure and types
// of every field it reads, about family names, and about script paths, which
// the runner reads from the APK's assets: each stays inside the plugin
// folder. The full rules are the kit's TS validator's (runtime-plugin.ts),
// which CI runs on every runtime we ship; we ship no other kind.
object RuntimeDecoder {
  const val SCHEMA = 1

  private val SAFE_PATH = Regex("""[A-Za-z0-9._+-]+(?:/[A-Za-z0-9._+-]+)*""")

  fun decode(text: String): RuntimeManifest {
    val r = JsonFields.parse(text)
    if (r.int("schema") != SCHEMA) throw ManifestException(r.at("schema"), "must be $SCHEMA")
    val install = r.obj("install")
    return RuntimeManifest(
      id = r.string("id"),
      label = r.string("label"),
      provides = r.int("provides"),
      families = InstallDecoder.families(r.at("families"), r.strings("families")),
      install = InstallDecoder.familyKeys(install).associateWithTo(LinkedHashMap()) { family ->
        install.string(family).also { path ->
          if (!SAFE_PATH.matches(path) || path.split('/').any { it == "." || it == ".." }) {
            throw ManifestException(install.at(family), "must be a path inside the plugin folder, not $path")
          }
        }
      },
      paths = r.optStrings("paths"),
      check = InstallDecoder.versionCheck(r.obj("check")),
    )
  }
}
