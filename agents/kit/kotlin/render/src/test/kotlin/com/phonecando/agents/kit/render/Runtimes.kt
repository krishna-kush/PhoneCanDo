package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.Manifest
import java.io.File

// Test plugins: the schema's node fixture, each install script a one-line
// stand-in naming its path, and made-up runtimes from their JSON.
object Runtimes {
  fun node(fixtures: File): RuntimePlugin =
    RuntimePlugin.load(File(fixtures, "runtime/valid/node.json").readText()) { path -> "echo 'would run $path'\n" }

  fun catalog(fixtures: File): Map<String, RuntimePlugin> = node(fixtures).let { mapOf(it.id to it) }

  /** A runtime from its fields (JSON members), its one script [script] for every family. */
  fun plugin(fields: String, script: String): RuntimePlugin =
    RuntimePlugin.load("""{"schema":1,"label":"T","install":{"*":"install.sh"},$fields}""") { script }

  /** An image kind with a tui engine that needs [runtimes] (JSON strings); [fields] are more JSON members. */
  fun kind(fields: String, runtimes: String = ""): Manifest = ManifestDecoder.decode(
    """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview",
       "requires":{"linux":"required","runtimes":[$runtimes]},"engine":{"style":"tui","launch":{"argv":["demo"]}},$fields}""",
  )
}
