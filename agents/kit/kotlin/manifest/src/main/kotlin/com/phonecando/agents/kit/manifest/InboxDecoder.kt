package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// The `inbox` block of an agent.json. Strict about the structure and types it
// reads, as ManifestDecoder is, and about what a template may be: a string,
// or an object for format json only. kit-render's KindChecks checks the rest
// (event names, placeholders, the wake mode); the full rules are the kit's TS
// validator's.
internal object InboxDecoder {
  // How an inbox call is sent (`inbox.server.*.method`), with a JSON body.
  private val METHODS = listOf("POST")

  fun inbox(i: JsonFields) = InboxSpec(
    hooks = i.optObj("hooks")?.let(::hooks).orEmpty(),
    server = i.optObj("server")?.let(::server),
    reader = i.optBoolean("reader") ?: false,
    wake = if (i.has("wake")) ManifestDecoder.enumOf(i, "wake", InboxWake.entries) { it.wire } else null,
  )

  private fun hooks(h: JsonFields): Map<String, InboxHook> =
    h.tree.keys.associateWithTo(LinkedHashMap()) { event -> hook(h.obj(event)) }

  private fun hook(h: JsonFields): InboxHook {
    val format = ManifestDecoder.enumOf(h, "format", InboxFormat.entries) { it.wire }
    val template = h.tree["template"] ?: throw ManifestException(h.at("template"), "is required")
    when {
      template is JsonObject -> if (format != InboxFormat.JSON) {
        throw ManifestException(h.at("template"), "an object template is JSON: format json")
      }
      template is JsonPrimitive && template.isString -> Unit
      else -> throw ManifestException(h.at("template"), "must be a string or an object")
    }
    val exit = h.optInt("exit") ?: 0
    if (exit !in 0..InboxHook.MAX_EXIT) throw ManifestException(h.at("exit"), "must be 0 to ${InboxHook.MAX_EXIT}, not $exit")
    return InboxHook(format, template, exit)
  }

  private fun server(s: JsonFields) = InboxServer(
    deliver = endpoint(s.obj("deliver")),
    wake = s.optObj("wake")?.let(::endpoint),
    latest = s.optObj("latest")?.let { InboxLookup(path = it.string("path"), id = it.string("id")) },
  )

  private fun endpoint(e: JsonFields) = InboxEndpoint(
    method = ManifestDecoder.enumOf(e, "method", METHODS) { it },
    path = e.string("path"),
    body = e.obj("body").tree,
  )
}
