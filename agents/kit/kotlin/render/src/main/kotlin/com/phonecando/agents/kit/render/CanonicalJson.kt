package com.phonecando.agents.kit.render

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

// One text for one JSON value, however its objects were ordered: keys
// sorted at every level (by UTF-16 code unit, as JS sorts them), arrays in
// their order, no whitespace. Values print as kotlinx prints them. Pure.
internal object CanonicalJson {
  fun of(value: JsonElement): String = sorted(value).toString()

  private fun sorted(value: JsonElement): JsonElement = when (value) {
    is JsonObject -> JsonObject(value.keys.sorted().associateWithTo(LinkedHashMap()) { sorted(value.getValue(it)) })
    is JsonArray -> JsonArray(value.map(::sorted))
    else -> value
  }
}
