package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.ManifestException
import com.phonecando.agents.kit.manifest.Origin
import com.phonecando.agents.kit.render.RuntimePlugin
import java.io.File

// The kit's folders on disk, read as the runner reads them from the APK's
// assets: a kind's agent.json, and every runtime plugin under a runtimes
// folder (<id>/runtime.json, its scripts beside it). A user.* id is read
// with the user rules, as the phone reads a user-added kind.
object KitFolders {
  private const val USER_PREFIX = "user."

  fun kind(dir: File): Manifest {
    val file = File(dir, "agent.json")
    if (!file.isFile) throw ManifestException("", "$file is not a file")
    val text = file.readText()
    val manifest = ManifestDecoder.decode(text)
    return if (manifest.id.startsWith(USER_PREFIX)) ManifestDecoder.decode(text, Origin.USER) else manifest
  }

  /** Every plugin in [dir], by id; a folder must be named after its runtime's id. */
  fun runtimes(dir: File): Map<String, RuntimePlugin> {
    val folders = dir.listFiles().orEmpty().filter { File(it, "runtime.json").isFile }.sortedBy { it.name }
    return folders.associate { folder ->
      val plugin = RuntimePlugin.load(File(folder, "runtime.json").readText()) { path -> File(folder, path).readText() }
      if (plugin.id != folder.name) throw ManifestException("/id", "runtime ${plugin.id} sits in folder ${folder.name}")
      plugin.id to plugin
    }
  }

  /** agents/runtimes for a kind in agents/<type>/<id>. */
  fun runtimesBeside(kind: File): File = File(kind.absoluteFile.parentFile.parentFile, "runtimes")
}
