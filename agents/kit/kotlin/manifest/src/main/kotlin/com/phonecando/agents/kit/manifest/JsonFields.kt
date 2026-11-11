package com.phonecando.agents.kit.manifest

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull

/** A manifest that cannot be read; [path] is the JSON pointer of the bad value ("" for the whole file), [detail] what is wrong with it. */
class ManifestException(val path: String, val detail: String) : IllegalArgumentException("${path.ifEmpty { "/" }}: $detail")

// Typed reads from one JSON object, each failure naming the JSON pointer of
// the value. Absent and null differ: an optional field may be absent, never
// null.
internal class JsonFields(val path: String, val tree: JsonObject) {
  fun at(key: String) = "$path/${key.replace("~", "~0").replace("/", "~1")}"

  fun string(key: String): String = optString(key) ?: throw ManifestException(at(key), "is required")

  fun optString(key: String): String? = tree[key]?.let { asString(at(key), it) }

  fun int(key: String): Int = optInt(key) ?: throw ManifestException(at(key), "is required")

  fun optInt(key: String): Int? = tree[key]?.let { value ->
    (value as? JsonPrimitive)?.takeIf { !it.isString }?.intOrNull
      ?: throw ManifestException(at(key), "must be an integer")
  }

  fun optBoolean(key: String): Boolean? = tree[key]?.let { value ->
    (value as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
      ?: throw ManifestException(at(key), "must be true or false")
  }

  /** Whether [key] is present at all (an optional field may be absent, never null). */
  fun has(key: String): Boolean = key in tree

  fun obj(key: String): JsonFields = optObj(key) ?: throw ManifestException(at(key), "is required")

  fun optObj(key: String): JsonFields? = tree[key]?.let { of(at(key), it) }

  fun array(key: String): JsonArray = optArray(key) ?: throw ManifestException(at(key), "is required")

  fun optArray(key: String): JsonArray? = tree[key]?.let { asArray(at(key), it) }

  fun strings(key: String): List<String> = optArray(key)?.let { strings(at(key), it) }
    ?: throw ManifestException(at(key), "is required")

  fun optStrings(key: String): List<String> = optArray(key)?.let { strings(at(key), it) } ?: emptyList()

  /** An object of strings, in manifest order. */
  fun stringMap(key: String): Map<String, String> {
    val inner = optObj(key) ?: return emptyMap()
    return inner.tree.keys.associateWithTo(LinkedHashMap()) { inner.string(it) }
  }

  companion object {
    /** The JSON object [text] holds, as the document root. */
    fun parse(text: String): JsonFields {
      val root = try {
        Json.parseToJsonElement(text)
      } catch (e: SerializationException) {
        throw ManifestException("", "not JSON (${e.message?.lineSequence()?.firstOrNull()})")
      }
      return of("", root)
    }

    fun of(path: String, value: JsonElement): JsonFields =
      JsonFields(path, value as? JsonObject ?: throw ManifestException(path, "must be an object, not ${describe(value)}"))

    fun asString(path: String, value: JsonElement): String =
      (value as? JsonPrimitive)?.takeIf { it.isString }?.content
        ?: throw ManifestException(path, "must be a string, not ${describe(value)}")

    fun asArray(path: String, value: JsonElement): JsonArray =
      value as? JsonArray ?: throw ManifestException(path, "must be an array, not ${describe(value)}")

    fun strings(path: String, array: JsonArray): List<String> =
      array.mapIndexed { i, item -> asString("$path/$i", item) }

    private fun describe(value: JsonElement): String = when {
      value is JsonNull -> "null"
      value is JsonObject -> "an object"
      value is JsonArray -> "an array"
      (value as JsonPrimitive).isString -> "a string"
      else -> value.content
    }
  }
}
