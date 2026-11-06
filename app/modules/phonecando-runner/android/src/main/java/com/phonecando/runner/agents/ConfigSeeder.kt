package com.phonecando.runner.agents

import java.io.File
import java.io.InputStream

/** Read-only view of the APK assets (AssetManager on the phone, a folder in tests). */
interface AssetTree {
  /** Children of a folder; empty for a file or an empty folder; null when unreadable. */
  fun list(path: String): List<String>?

  fun open(path: String): InputStream
}

// Copies a kind's config from the assets into the engine HOME on every start.
// A manifest of the files it copied lets the next start delete the ones we no
// longer ship (a renamed plugin folder would otherwise register its tools
// twice). Only files listed in that manifest are ever deleted: user files and
// the keep-if-present ones are never touched. Pure Kotlin.
class ConfigSeeder(private val assets: AssetTree) {
  fun seed(config: AgentConfig, home: File) {
    val top = assets.list(config.assetDir).orEmpty()
    if (top.isEmpty()) return // dev build without staged config: skip silently
    val dest = File(home, config.homeDir).apply { mkdirs() }
    val seeded = sortedSetOf<String>()
    for (name in top) copy("${config.assetDir}/$name", name, dest, config.keepIfPresent, seeded)
    prune(dest, readManifest(dest) - seeded - config.keepIfPresent)
    writeManifest(dest, seeded)
  }

  private fun copy(assetPath: String, rel: String, dest: File, keep: Set<String>, seeded: MutableSet<String>) {
    val kids = try {
      assets.list(assetPath)
    } catch (_: Exception) {
      null
    }
    val target = File(dest, rel)
    if (kids.isNullOrEmpty()) {
      // A file, or an empty folder: AssetManager lists both as empty.
      if (rel in keep && target.exists()) return
      try {
        assets.open(assetPath).use { inp ->
          target.parentFile?.mkdirs()
          target.outputStream().use { out -> inp.copyTo(out) }
        }
        if (rel !in keep) seeded += rel
      } catch (_: Exception) {
        target.mkdirs()
      }
      return
    }
    target.mkdirs()
    for (child in kids) copy("$assetPath/$child", "$rel/$child", dest, keep, seeded)
  }

  private fun prune(dest: File, stale: Set<String>) {
    val root = dest.canonicalFile
    for (rel in stale) {
      val file = File(dest, rel).canonicalFile
      // The manifest is our own file, but never follow it out of dest.
      if (!file.path.startsWith(root.path + File.separator)) continue
      if (file.isFile) file.delete()
      var dir = file.parentFile
      while (dir != null && dir != root && dir.list()?.isEmpty() == true) {
        dir.delete()
        dir = dir.parentFile
      }
    }
  }

  private fun readManifest(dest: File): Set<String> = try {
    File(dest, MANIFEST).readLines().filter { it.isNotBlank() }.toSet()
  } catch (_: Exception) {
    emptySet()
  }

  private fun writeManifest(dest: File, seeded: Set<String>) {
    try {
      File(dest, MANIFEST).writeText(seeded.joinToString("\n", postfix = "\n"))
    } catch (_: Exception) {
      // Next start prunes nothing it cannot read; seeding itself succeeded.
    }
  }

  companion object {
    const val MANIFEST = ".phonecando-seeded"
  }
}
