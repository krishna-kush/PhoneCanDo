package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.HomeSurface
import com.phonecando.agents.kit.manifest.LinuxNeed
import com.phonecando.agents.kit.manifest.Manifest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// What the app may know about a kind (agents/kit/ts/contract/view.ts):
// identity and origin, which Home it shows (the TUI when the manifest names
// no surfaces), the web adapter spec and the TUI's chat title pattern, both
// verbatim, the sign-in options, and what the picker needs: whether it
// needs Linux and which commands on the guest PATH, the OS families its
// install supports with its runtimes' (null: any), the runtimes it
// installs, whether it is installed at all before its agent starts, and
// whether this build has its payload (a native kind's libs, as [libExists]
// finds them; always true for an image kind). Never a template or a
// secret: launches, requests and the TUI client are rendered natively.
object KindView {
  fun of(kind: ManifestKind, isDefault: Boolean, libExists: (String) -> Boolean): JsonObject {
    val manifest = kind.manifest
    return buildJsonObject {
      put("id", manifest.id)
      put("label", manifest.label)
      put("version", manifest.version)
      put("type", manifest.type)
      put("channels", JsonArray(manifest.channels.map(::JsonPrimitive)))
      put("stability", manifest.stability)
      put("origin", manifest.origin.wire)
      put("isDefault", isDefault)
      put("home", (manifest.surfaces?.home ?: HomeSurface.TUI).wire)
      put("web", manifest.surfaces?.web?.adapter?.let { buildJsonObject { put("adapter", it) } } ?: JsonNull)
      put("chatTitle", kind.chatTitle)
      put("signIn", manifest.signIn)
      put("requiresLinux", manifest.linux == LinuxNeed.REQUIRED)
      put("commands", JsonArray(manifest.commands.map(::JsonPrimitive)))
      put("families", kind.families?.let { JsonArray(it.map(::JsonPrimitive)) } ?: JsonNull)
      put("runtimes", JsonArray(kind.runtimes.map { JsonPrimitive(it.plugin.id) }))
      put("hasInstall", kind.hasInstall)
      put("payloadPresent", payloadPresent(manifest, libExists))
    }
  }

  /** The JSON array the runner hands to the app (listKinds). */
  fun list(kinds: List<ManifestKind>, defaultId: String, libExists: (String) -> Boolean): String =
    JsonArray(kinds.map { of(it, it.id == defaultId, libExists) }).toString()

  private fun payloadPresent(manifest: Manifest, libExists: (String) -> Boolean) =
    manifest.type != TYPE_NATIVE || manifest.payloadLibs.all(libExists)

  private const val TYPE_NATIVE = "native"
}
