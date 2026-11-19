package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ArgvItem
import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.Origin
import com.phonecando.agents.kit.manifest.PhoneTools
import kotlinx.serialization.json.JsonObject

// What ManifestKind.of() refuses in `phoneToolsTrust` (KindChecks' part for
// it). Our phone tools never wait on the agent's own approval prompt, so a
// kind that loads them as an MCP server names the setting that trusts our
// server: required on a bundled kind (CI also checks a trust file holds
// `has`; the phone reads no asset here), optional on a user kind, whose
// manifests saved before the field must keep loading and which has no
// config folder, so it can trust only in its launch args.
internal object PhoneToolsChecks {
  /** The most characters `has` holds (the TS validator's MAX.trustHas). */
  const val MAX_HAS = 256

  private val MCP = setOf(PhoneTools.MCP_CONFIG, PhoneTools.MCP_ARGV)

  fun check(manifest: Manifest) {
    val id = manifest.id
    val mcp = manifest.phoneTools in MCP
    val trust = manifest.phoneToolsTrust
    if (trust == null) {
      if (mcp && manifest.origin == Origin.BUNDLED) throw KindException("$id: a kind with MCP phone tools needs phoneToolsTrust")
      return
    }
    if (!mcp) throw KindException("$id: phoneToolsTrust goes with phoneTools mcp:argv or mcp:config")
    if (trust.has.isEmpty() || trust.has.length > MAX_HAS) throw KindException("$id: phoneToolsTrust.has is 1..$MAX_HAS characters")
    if (trust.inArgv) {
      val args = manifest.engine?.launch?.argv.orEmpty().flatMap { item ->
        when (item) {
          is ArgvItem.Text -> listOf(item.template)
          is ArgvItem.When -> item.args
        }
      }
      if (args.none { trust.has in it }) throw KindException("$id: engine.launch.argv holds no ${trust.has}")
      return
    }
    if (manifest.origin == Origin.USER) throw KindException("$id: a user kind has no config folder, so its phoneToolsTrust is in argv")
    if ((manifest.json["config"] as? JsonObject)?.containsKey("dir") != true) {
      throw KindException("$id: phoneToolsTrust.in ${trust.place} needs config.dir")
    }
  }
}
