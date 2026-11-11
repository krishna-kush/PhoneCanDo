package com.phonecando.runner.agents

import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.render.KindAssets
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.agents.user.UserKindRules
import java.io.File

// Every agent kind this build can run, by id: each packaged manifest
// (assets/agents/<id>/agent.json, see agents.gradle) decoded and bound to its
// kind's code hooks, then each kind the user added (<id>.json in the user
// folder, files/state/agent-kinds/user/ on the phone), held to the user
// kinds' rules (user/UserKindRules: an image kind whose engine is its TUI,
// no hooks, at most 64 KiB). A kind that cannot be read or run
// here (a bad manifest, a hook this build lacks, an id taken or not its
// file's) is left out and reported through `skipped`, so one broken kind
// never takes the others down. Each kind is bound to the runtime plugins
// it needs (RuntimeCatalog); one that needs a runtime this build lacks, or
// a newer one, cannot run here and is left out the same way. The asset
// folders beside the kinds that hold none (NOT_KINDS: the runtimes, the
// kit's scripts, shared parts) are passed over. The default kind is the
// bundled one whose manifest says so (`default: true`; the kit's checks
// allow one at most, the user rules none). Pure: the phone reads the APK
// assets (KindCatalogs), the JVM tests a folder.
class KindCatalog(kinds: List<ManifestKind>, private val defaultId: String) {
  private val byId: Map<String, ManifestKind> = kinds.associateBy { it.id }

  fun get(id: String): ManifestKind? = byId[id]

  /** The bundled kinds in id order, then the user's in id order. */
  fun all(): List<ManifestKind> = byId.values.toList()

  /** The kind a fresh install starts with; null when this build could not load it. */
  val default: ManifestKind? get() = byId[defaultId]

  companion object {
    /** Folders of assets/agents/ that are no kind (agents.gradle packages them beside the kinds). */
    val NOT_KINDS = setOf(RuntimeCatalog.FOLDER, "kit", "shared")

    /** [userDir]: the user's kinds (absent: none); [skipped] names a user kind `user/<file>`. */
    fun load(
      assets: AssetTree,
      userDir: File?,
      hooks: Map<String, KindHooks>,
      runtimes: RuntimeCatalog,
      skipped: (folder: String, error: Exception) -> Unit,
    ): KindCatalog {
      val folders = assets.list(KindAssets.ROOT).orEmpty().filter { it !in NOT_KINDS }.sorted()
      val bundled = folders.mapNotNull { folder ->
        try {
          val text = assets.open(KindAssets.manifest(folder)).use { it.readBytes().toString(Charsets.UTF_8) }
          val manifest = ManifestDecoder.decode(text)
          require(manifest.id == folder) { "its id is ${manifest.id}" }
          ManifestKind.of(manifest, hooks[manifest.id], runtimes.byId)
        } catch (e: Exception) {
          skipped(folder, e)
          null
        }
      }
      val taken = bundled.map { it.id }.toSet()
      val defaultId = bundled.firstOrNull { it.manifest.isDefault }?.id.orEmpty()
      return KindCatalog(bundled + userDir?.let { loadUser(it, taken, runtimes, skipped) }.orEmpty(), defaultId)
    }

    private fun loadUser(
      dir: File,
      taken: Set<String>,
      runtimes: RuntimeCatalog,
      skipped: (String, Exception) -> Unit,
    ): List<ManifestKind> {
      val files = dir.listFiles { f -> f.name.endsWith(UserKindRules.SUFFIX) }.orEmpty().sortedBy { it.name }
      return files.mapNotNull { file ->
        try {
          require(file.isFile) { "not a file" }
          require(file.length() <= UserKindRules.MAX_BYTES) { "larger than ${UserKindRules.MAX_BYTES / 1024} KiB" }
          val kind = UserKindRules.kind(file.readBytes(), taken, runtimes.byId)
          require(file.name == UserKindRules.fileName(kind.id)) { "its id is ${kind.id}" }
          kind
        } catch (e: Exception) {
          skipped("user/${file.name}", e)
          null
        }
      }
    }
  }
}
