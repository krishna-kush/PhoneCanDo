package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.manifest.PhoneTools
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import java.security.MessageDigest

// What a kind's manifest says its agents can do, and the setting each
// capability's check belongs to. declared() reads the manifest; a capability
// it leaves out is off. key() names the exact setting: the manifest's
// version, then the first 16 hex of the sha-256 of the canonical JSON
// (CanonicalJson) of an object holding the manifest parts that capability
// rests on, each under its dotted path (an absent part is null). Editing a
// user kind or shipping a changed kind changes the key, so a check made
// before no longer counts. `state` is declared by the kind's state block;
// whether one agent keeps a state folder of its own is the runner's to say.
// Pure.
object KindCapabilities {
  private val BRIDGED = setOf(PhoneTools.PLUGIN, PhoneTools.MCP_CONFIG, PhoneTools.MCP_ARGV)

  // The key's hash: 16 hex digits.
  private const val HASH_BYTES = 8

  /** What [kind]'s manifest declares, in Capability order. */
  fun declared(kind: ManifestKind): Set<Capability> {
    val m = kind.manifest
    val inbox = m.inbox
    val tools = m.phoneTools in BRIDGED
    val hooks = !inbox?.hooks.isNullOrEmpty()
    val acp = m.engine?.acp
    return Capability.entries.filterTo(LinkedHashSet()) {
      when (it) {
        Capability.TOOLS -> tools
        Capability.MESSAGES -> hooks || inbox?.reader == true || inbox?.server != null
        Capability.WAKE -> inbox?.wake != null
        Capability.TASK -> m.engine?.prompt != null
        Capability.STATE -> m.state != null
        Capability.ACP -> acp != null
        Capability.ACP_TOOLS -> acp != null && tools
        Capability.ACP_MESSAGES -> acp != null && hooks
        Capability.CHAT -> acp?.chat != null
      }
    }
  }

  /** The setting [capability]'s check on [kind] belongs to: `<manifest version>:<16 hex>`. */
  fun key(kind: ManifestKind, capability: Capability): String {
    val json = kind.manifest.json
    val setting = JsonObject(parts(capability).associateWith { at(json, it) })
    val hash = MessageDigest.getInstance("SHA-256").digest(CanonicalJson.of(setting).toByteArray(Charsets.UTF_8))
    return "${kind.manifest.version}:" + hash.take(HASH_BYTES).joinToString("") { "%02x".format(it) }
  }

  /** The manifest parts [capability] rests on, as dotted paths in agent.json. */
  internal fun parts(capability: Capability): List<String> = when (capability) {
    Capability.TOOLS -> listOf("phoneTools", "phoneToolsTrust", "engine.launch", "config")
    Capability.MESSAGES, Capability.WAKE -> listOf("inbox", "config")
    Capability.TASK -> listOf("engine.prompt", "engine.launch")
    Capability.STATE -> listOf("state")
    Capability.ACP -> listOf("engine.acp")
    Capability.ACP_TOOLS -> listOf("engine.acp", "phoneTools", "phoneToolsTrust", "config")
    Capability.ACP_MESSAGES -> listOf("engine.acp", "inbox", "config")
    Capability.CHAT -> listOf("engine.acp.chat", "engine.launch")
  }

  // The value at [path] in [json]; null when any step is absent.
  private fun at(json: JsonObject, path: String): JsonElement {
    var node: JsonElement = json
    for (key in path.split('.')) node = (node as? JsonObject)?.get(key) ?: return JsonNull
    return node
  }
}
