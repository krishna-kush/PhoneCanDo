package com.phonecando.runner.models.chats

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.security.MessageDigest

// Which chat a request to a model server continues: a hash of its stable
// head, per wire API: the model it names, its system prompt or
// instructions, its tools and its first user message. Every turn of a chat
// sends the same head; an agent and its helper, or two agents, send
// different ones. Prompt-cache marks (`cache_control`) move from turn to
// turn, so they are left out. A wrong key costs speed, never correctness:
// the server still matches the request's tokens against what its slot
// holds. Pure.
internal object ChatKeys {
  enum class Api { ANTHROPIC, OPENAI_CHAT, OPENAI_RESPONSES, COMPLETION }

  /** Hex characters of a key (128 bits). */
  const val LENGTH = 32

  /** The most of a raw prompt's text a completion's key reads. */
  private const val PROMPT_HEAD = 8_192

  private val SYSTEM_ROLES = setOf("system", "developer")

  // The pinned llama-server's routes that run the model on its slot.
  private val ROUTES = mapOf(
    "/v1/messages" to Api.ANTHROPIC,
    "/v1/chat/completions" to Api.OPENAI_CHAT,
    "/chat/completions" to Api.OPENAI_CHAT,
    "/v1/responses" to Api.OPENAI_RESPONSES,
    "/responses" to Api.OPENAI_RESPONSES,
    "/v1/completions" to Api.COMPLETION,
    "/completions" to Api.COMPLETION,
    "/completion" to Api.COMPLETION,
    "/infill" to Api.COMPLETION,
  )

  /** The API of a request that runs the model on the server's slot; null for any other (models, token counts, health). */
  fun api(method: String, path: String): Api? = if (method == "POST") ROUTES[path.trimEnd('/').ifEmpty { "/" }] else null

  /** [body]'s chat key for [api]; null when it is not a JSON object we can read. */
  fun key(api: Api, body: String): String? {
    val json = try {
      JSONObject(body)
    } catch (_: JSONException) {
      return null
    }
    val head = JSONArray().put(api.name).put(json.opt("model") ?: JSONObject.NULL)
    when (api) {
      Api.ANTHROPIC -> head.put(json.opt("system")).put(json.opt("tools")).put(firstUser(json.optJSONArray("messages")))
      Api.OPENAI_CHAT -> {
        val messages = json.optJSONArray("messages")
        head.put(leadingSystem(messages)).put(json.opt("tools")).put(firstUser(messages))
      }
      Api.OPENAI_RESPONSES -> {
        head.put(json.opt("instructions")).put(json.opt("tools"))
        when (val input = json.opt("input")) {
          is JSONArray -> head.put(leadingSystem(input)).put(firstUser(input))
          else -> head.put(input)
        }
      }
      Api.COMPLETION -> head.put(promptHead(json.opt("prompt"))).put(json.opt("input_prefix"))
    }
    return hash(canonical(head))
  }

  /** The leading system or developer messages' content, in order. */
  private fun leadingSystem(items: JSONArray?): JSONArray {
    val out = JSONArray()
    if (items == null) return out
    for (i in 0 until items.length()) {
      val item = items.optJSONObject(i) ?: break
      if (item.optString("role") !in SYSTEM_ROLES) break
      out.put(item.opt("content"))
    }
    return out
  }

  /** The first user message's content; null when there is none. */
  private fun firstUser(items: JSONArray?): Any? {
    if (items == null) return null
    for (i in 0 until items.length()) {
      val item = items.optJSONObject(i) ?: continue
      if (item.optString("role") == "user") return item.opt("content")
    }
    return null
  }

  private fun promptHead(prompt: Any?): Any? = when (prompt) {
    is String -> prompt.take(PROMPT_HEAD)
    is JSONArray -> promptHead(prompt.opt(0))
    else -> prompt
  }

  /** [value] as JSON with every object's keys sorted and `cache_control` left out. */
  fun canonical(value: Any?): String = StringBuilder().also { write(it, value) }.toString()

  private fun write(out: StringBuilder, value: Any?) {
    when (value) {
      null, JSONObject.NULL -> out.append("null")
      is JSONObject -> {
        out.append('{')
        var first = true
        for (k in value.keys().asSequence().filter { it != "cache_control" }.sorted()) {
          if (!first) out.append(',')
          first = false
          out.append(JSONObject.quote(k)).append(':')
          write(out, value.opt(k))
        }
        out.append('}')
      }
      is JSONArray -> {
        out.append('[')
        for (i in 0 until value.length()) {
          if (i > 0) out.append(',')
          write(out, value.opt(i))
        }
        out.append(']')
      }
      is String -> out.append(JSONObject.quote(value))
      is Number -> out.append(JSONObject.numberToString(value))
      else -> out.append(value.toString())
    }
  }

  private fun hash(text: String): String =
    MessageDigest.getInstance("SHA-256").digest(text.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) }.take(LENGTH)
}
