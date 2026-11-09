package com.phonecando.agents.kit.manifest

// The install blocks of an agent.json (requires.runtimes, install, update,
// versionCheck) and the shared pieces a runtime.json reuses (package family
// keys, version checks). Strict about the structure and types they read and
// about family names, as ManifestDecoder is, and about install.retries' range
// (it sets how often the rendered script runs a unit); the full rules are the
// kit's TS validator's.
internal object InstallDecoder {
  fun runtimes(requires: JsonFields): List<RuntimeNeed> {
    val at = requires.at("runtimes")
    val needs = requires.optStrings("runtimes").mapIndexed { i, text ->
      RuntimeNeed.parse(text) ?: throw ManifestException("$at/$i", "must be <id> or <id>>=<major>, not $text")
    }
    needs.groupBy { it.id }.values.firstOrNull { it.size > 1 }?.let {
      throw ManifestException(at, "names runtime ${it.first().id} twice")
    }
    return needs
  }

  fun install(i: JsonFields) = Install(
    families = i.optArray("families")?.let { families(i.at("families"), JsonFields.strings(i.at("families"), it)) },
    packages = i.optObj("packages")?.let { p -> familyKeys(p).associateWithTo(LinkedHashMap()) { p.strings(it) } }.orEmpty(),
    steps = i.optStrings("steps"),
    timeoutSec = i.optInt("timeoutSec"),
    retries = i.optInt("retries")?.also {
      if (it !in 0..Install.MAX_RETRIES) throw ManifestException(i.at("retries"), "must be 0 to ${Install.MAX_RETRIES}, not $it")
    },
  )

  fun update(u: JsonFields) = Update(u.strings("steps"))

  fun versionCheck(v: JsonFields) = VersionCheck(v.strings("argv"), v.string("pattern"))

  /** Each item a family this build knows. */
  fun families(path: String, names: List<String>): List<String> = names.onEachIndexed { i, name ->
    if (name !in PackageFamilies.ALL) throw ManifestException("$path/$i", "must be one of ${PackageFamilies.ALL.joinToString()}, not $name")
  }

  /** The keys of an object keyed by family, [PackageFamilies.ANY] the fallback, in order. */
  fun familyKeys(o: JsonFields): List<String> = o.tree.keys.onEach { key ->
    if (key != PackageFamilies.ANY && key !in PackageFamilies.ALL) {
      throw ManifestException(o.at(key), "must be a family (${PackageFamilies.ALL.joinToString()}) or ${PackageFamilies.ANY}")
    }
  }.toList()
}
