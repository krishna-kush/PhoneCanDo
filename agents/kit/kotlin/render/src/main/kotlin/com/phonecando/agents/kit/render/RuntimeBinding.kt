package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.PackageFamilies

/** A runtime a kind needs, with the plugin that provides it and the lowest major version the kind takes (null: any). */
data class BoundRuntime(val plugin: RuntimePlugin, val atLeast: Int?)

// A kind's `requires.runtimes` bound to the runtime plugins this build has,
// and what follows from them: the families the kind installs on and the
// guest folders that go first on PATH.
object RuntimeBinding {
  /**
   * [manifest]'s runtimes from [catalog] (plugins by id), in manifest order.
   * Throws KindException for one the catalog lacks, or one whose plugin
   * provides less than the kind needs.
   */
  fun bind(manifest: Manifest, catalog: Map<String, RuntimePlugin>): List<BoundRuntime> = manifest.runtimes.map { need ->
    val plugin = catalog[need.id] ?: throw KindException("${manifest.id}: needs runtime ${need.id}, which this build does not have")
    val provides = plugin.manifest.provides
    val atLeast = need.atLeast
    if (atLeast != null && atLeast > provides) {
      throw KindException("${manifest.id}: needs ${need.id}>=$atLeast, and its plugin provides $provides")
    }
    BoundRuntime(plugin, need.atLeast)
  }

  /**
   * The families the kind installs on: its own (`install.families`, else
   * every one) narrowed to those each runtime installs on, in the kind's
   * order; null (any) when it names neither.
   */
  fun families(manifest: Manifest, runtimes: List<BoundRuntime>): List<String>? {
    val own = manifest.install?.families
    if (own == null && runtimes.isEmpty()) return null
    return runtimes.fold(own ?: PackageFamilies.ALL) { families, r -> families.filter { it in r.plugin.manifest.families } }
  }

  /** Every runtime's paths, {{home}} filled in with [home], in order. */
  fun paths(runtimes: List<BoundRuntime>, home: String): List<String> =
    runtimes.flatMap { r -> r.plugin.manifest.paths.map { Templates.render(it, mapOf("home" to home)) } }.distinct()
}
