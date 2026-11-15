package com.phonecando.agents.kit.render

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// A JSON tree whose strings are templates (an inbox call's body, an inbox
// hook's object template, an ACP mode's meta): only string values are
// read or filled, never keys, numbers or the tree's shape. Serialised after
// filling, so each filled value is escaped as JSON. Pure.
internal object JsonTemplates {
  /** Every string in [element] (an object's values, not its keys), depth first. */
  fun strings(element: JsonElement): List<String> = when (element) {
    is JsonObject -> element.values.flatMap(::strings)
    is JsonArray -> element.flatMap(::strings)
    is JsonPrimitive -> if (element.isString) listOf(element.content) else emptyList()
  }

  /** Each string in [element] filled from [values]; keys and other values as they are. */
  fun fill(element: JsonElement, values: Map<String, String>): JsonElement = when (element) {
    is JsonObject -> JsonObject(element.mapValues { fill(it.value, values) })
    is JsonArray -> JsonArray(element.map { fill(it, values) })
    is JsonPrimitive -> if (element.isString) JsonPrimitive(Templates.render(element.content, values)) else element
  }
}
