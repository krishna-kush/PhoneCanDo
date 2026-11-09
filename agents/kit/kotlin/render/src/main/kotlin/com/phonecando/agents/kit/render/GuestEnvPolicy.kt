package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Manifest

// What an agent's image must not inherit from the engine's environment.
// A native kind's engine runs outside the image, and only the programs it
// starts in there (its shell commands, the terminal's shell) see the image,
// so they lose the bridge (its URL and token) and every env value the kind
// fills with a secret ({{password}}, {{secret:…}}). An image kind's engine
// is itself the guest, run through our launcher, and needs the bridge for
// its MCP phone tools, so it keeps everything. lre always unsets LD_* too.
object GuestEnvPolicy {
  const val BRIDGE_URL = "PHONECANDO_BRIDGE_URL"
  const val BRIDGE_TOKEN = "PHONECANDO_BRIDGE_TOKEN"

  private val SECRET = Regex("""\{\{(?:password|secret:[^{}]*)\}\}""")

  /** The env names to unset in [manifest]'s image, in a stable order; empty for an image kind. */
  fun unset(manifest: Manifest): List<String> {
    if (manifest.type == TYPE_IMAGE) return emptyList()
    val commands = listOfNotNull(manifest.engine?.launch, manifest.surfaces?.terminal?.client)
    val secrets = commands.flatMap { it.env.entries }.filter { SECRET.containsMatchIn(it.value) }.map { it.key }
    return (listOf(BRIDGE_URL, BRIDGE_TOKEN) + secrets).distinct()
  }

  private const val TYPE_IMAGE = "image"
}
