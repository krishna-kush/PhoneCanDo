package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.RuntimeDecoder
import com.phonecando.agents.kit.manifest.RuntimeManifest

/**
 * A runtime plugin (agents/runtimes/<id>/, packaged as RuntimeAssets says):
 * its runtime.json and the text of every install script it names. The
 * install script inlines the script for the image's family, since it runs
 * in the guest, where the plugin folder is not.
 */
class RuntimePlugin(val manifest: RuntimeManifest, private val scripts: Map<String, String>) {
  val id: String get() = manifest.id

  /** The install script's text for [family]; null when the runtime does not install on it. */
  fun script(family: String): String? = manifest.scriptFor(family)?.let { scripts[it] }

  companion object {
    /**
     * Decodes runtime.json [text] and reads each install script it names
     * through [read], which gets the script's path in the plugin folder.
     * Throws ManifestException for a runtime.json that cannot be read.
     */
    fun load(text: String, read: (String) -> String): RuntimePlugin {
      val manifest = RuntimeDecoder.decode(text)
      return RuntimePlugin(manifest, manifest.install.values.distinct().associateWith(read))
    }
  }
}

/** Where runtimes land in the APK's assets (the runner's agents.gradle packages them so). */
object RuntimeAssets {
  const val ROOT = "${KindAssets.ROOT}/runtimes"

  fun manifest(id: String) = "$ROOT/$id/runtime.json"

  /** A file the runtime's manifest names, by its path in the plugin folder. */
  fun file(id: String, path: String) = "$ROOT/$id/$path"
}
