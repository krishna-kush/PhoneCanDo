package com.phonecando.runner.agents.user

import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.ManifestException
import com.phonecando.agents.kit.manifest.Origin
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.agents.kit.render.RuntimePlugin

// What a user kind's file must hold, the same when the catalog loads it
// (KindCatalog) and when the user saves it (UserKinds): at most MAX_BYTES,
// a manifest that keeps the user rules (kit-manifest ManifestDecoder,
// origin user: an image kind with a TUI engine, a `user.` id, no hooks…),
// a `user.<name>` id no bundled kind has, and a kind this build can run
// (ManifestKind.of: the runtimes it needs, patterns that compile). Its file
// is <id>.json. Pure.
object UserKindRules {
  const val MAX_BYTES = 64 * 1024
  const val SUFFIX = ".json"

  // A user kind's id (the kit's id pattern with its user. prefix), so a
  // name from JS can never point outside the folder.
  private val ID = Regex("""user\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*""")
  private const val MAX_ID = 64

  fun isId(id: String): Boolean = id.length <= MAX_ID && ID.matches(id)

  fun fileName(id: String): String = id + SUFFIX

  /**
   * The kind [bytes] hold. Throws ManifestException at the JSON pointer of
   * the value that breaks a rule ("" for the whole file), KindException for
   * what this build cannot run.
   */
  fun kind(bytes: ByteArray, bundled: Set<String>, runtimes: Map<String, RuntimePlugin>): ManifestKind {
    if (bytes.size > MAX_BYTES) throw ManifestException("", "larger than ${MAX_BYTES / 1024} KiB")
    val manifest = ManifestDecoder.decode(bytes.toString(Charsets.UTF_8), Origin.USER)
    if (!isId(manifest.id)) {
      throw ManifestException("/id", "a user kind's id is user.<name>: lowercase letters, digits and dashes, at most $MAX_ID")
    }
    if (manifest.id in bundled) throw ManifestException("/id", "${manifest.id} is a bundled kind's id")
    return ManifestKind.of(manifest, null, runtimes)
  }
}
