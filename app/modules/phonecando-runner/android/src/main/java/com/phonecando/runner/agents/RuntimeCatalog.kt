package com.phonecando.runner.agents

import com.phonecando.agents.kit.render.RuntimeAssets
import com.phonecando.agents.kit.render.RuntimePlugin

// Every runtime plugin this build ships, by id: each packaged
// assets/agents/runtimes/<id>/ (runtime.json and the install scripts it
// names; agents.gradle packages them on the channels that ship Linux, so
// play has none), read with its scripts (kit-render RuntimePlugin). The
// kinds bind to it (KindCatalog), and a runtime is installed only into the
// machine of an agent whose kind needs it (agents/install/). One that
// cannot be read, or whose id is not its folder's, is left out and
// reported through `skipped`, and so is every kind that needs it. Pure:
// the phone reads the APK assets (RuntimeCatalogs), the JVM tests a folder.
class RuntimeCatalog(plugins: List<RuntimePlugin>) {
  /** The plugins by id, as ManifestKind.of takes them. */
  val byId: Map<String, RuntimePlugin> = plugins.associateBy { it.id }

  companion object {
    /** The runtimes' folder under assets/agents/ (RuntimeAssets.ROOT). */
    val FOLDER = RuntimeAssets.ROOT.substringAfterLast('/')

    fun load(assets: AssetTree, skipped: (folder: String, error: Exception) -> Unit): RuntimeCatalog {
      val folders = assets.list(RuntimeAssets.ROOT).orEmpty().sorted()
      return RuntimeCatalog(
        folders.mapNotNull { folder ->
          try {
            val plugin = RuntimePlugin.load(read(assets, RuntimeAssets.manifest(folder))) { path ->
              read(assets, RuntimeAssets.file(folder, path))
            }
            require(plugin.id == folder) { "its id is ${plugin.id}" }
            plugin
          } catch (e: Exception) {
            skipped(folder, e)
            null
          }
        },
      )
    }

    private fun read(assets: AssetTree, path: String) = assets.open(path).use { it.readBytes().toString(Charsets.UTF_8) }
  }
}
