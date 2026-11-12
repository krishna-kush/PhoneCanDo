package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Manifest

// What an agent's image must not inherit from the engine's environment.
// A native kind's engine runs outside the image, and only the programs it
// starts in there (its shell commands, the terminal's shell) see the image,
// so they lose the bridge (its URL and token) and every env value the kind
// fills with a secret ({{password}}, {{secret:…}}, a local model's
// {{modelKey}}). An image kind's engine
// is itself the guest, run through our launcher, and needs the bridge for
// its MCP phone tools, so it keeps everything. lre always unsets LD_* too.
// Agents that share a machine share its launch.conf, so it unsets the union
// of theirs; an image kind's engine carries what of that it still needs
// past the launcher (ImageLaunch.CARRY_PREFIX).
object GuestEnvPolicy {
  const val BRIDGE_URL = "PHONECANDO_BRIDGE_URL"
  const val BRIDGE_TOKEN = "PHONECANDO_BRIDGE_TOKEN"

  private val SECRET = Regex("""\{\{(?:password|modelKey|secret:[^{}]*)\}\}""")

  /** The env names to unset in [manifest]'s image, in a stable order; empty for an image kind. */
  fun unset(manifest: Manifest): List<String> {
    if (manifest.type == TYPE_IMAGE) return emptyList()
    val commands = listOfNotNull(manifest.engine?.launch, manifest.surfaces?.terminal?.client)
    val env = commands.flatMap { it.env.entries } + manifest.models.flatMap { it.env.entries }
    val secrets = env.filter { SECRET.containsMatchIn(it.value) }.map { it.key }
    return (listOf(BRIDGE_URL, BRIDGE_TOKEN) + secrets).distinct()
  }

  /** What one image shared by agents of [manifests] unsets: each kind's [unset], in order, each name once. */
  fun union(manifests: Collection<Manifest>): List<String> = manifests.flatMap(::unset).distinct()

  /**
   * The names in [env] (an engine's) that [unset] strips, each listed by
   * name or by a prefix with a trailing `*` (as lre's launch.conf reads
   * them): what an image kind's engine carries past its image's launcher.
   */
  fun carry(env: Collection<String>, unset: Collection<String>): Set<String> = env.filterTo(LinkedHashSet()) { name ->
    unset.any { if (it.endsWith("*")) name.startsWith(it.dropLast(1)) else name == it }
  }

  private const val TYPE_IMAGE = "image"
}
