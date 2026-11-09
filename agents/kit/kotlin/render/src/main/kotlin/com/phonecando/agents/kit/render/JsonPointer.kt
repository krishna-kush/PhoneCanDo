package com.phonecando.agents.kit.render

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// RFC 6901 JSON pointers ("/data/title"), for the values the manifest says
// where to find in an engine's answer.
object JsonPointer {
  /** The element [pointer] names in [root]; null when there is none. */
  fun resolve(root: JsonElement, pointer: String): JsonElement? {
    if (pointer.isEmpty()) return root
    if (!pointer.startsWith('/')) return null
    var node = root
    for (raw in pointer.substring(1).split('/')) {
      val token = raw.replace("~1", "/").replace("~0", "~")
      node = when (node) {
        is JsonObject -> node[token]
        is JsonArray -> token.takeIf { it.all(Char::isDigit) }?.toIntOrNull()?.let(node::getOrNull)
        else -> null
      } ?: return null
    }
    return node
  }

  /** The scalar at [pointer] in the JSON text [body] as text; null for no JSON, null, an object or an array. */
  fun text(body: String, pointer: String): String? {
    val root = try {
      Json.parseToJsonElement(body)
    } catch (_: SerializationException) {
      return null
    }
    val value = resolve(root, pointer)
    return if (value is JsonPrimitive && value !is JsonNull) value.content else null
  }
}
