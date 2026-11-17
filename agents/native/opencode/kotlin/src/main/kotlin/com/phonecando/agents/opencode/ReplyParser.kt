package com.phonecando.agents.opencode

import org.json.JSONArray
import org.json.JSONObject

// A chat's last reply (agent.json `chats.reply`): GET
// /api/session/<id>/message lists a session's messages, newest first
// (order desc, the default), as {"data":[…],"cursor":{…}}; we ask for
// type=assistant and limit=1. An assistant message is one step of a run:
// {"type":"assistant","content":[…]}, each content item a text
// ({"type":"text","text":…}), a reasoning or a tool call. The run's answer
// is the newest assistant message's text items, joined (v2.0.26
// packages/protocol/src/groups/message.ts, packages/schema/src/
// session-message.ts). Null when it has no text (a step that ended in a
// tool call or an error). Pure Kotlin, zero Android imports.
internal object ReplyParser {
  fun parse(body: String): String? {
    val messages = try {
      JSONObject(body).optJSONArray("data")
    } catch (_: Exception) {
      return null
    } ?: return null
    val newest = objects(messages).firstOrNull { it.optString("type") == ASSISTANT } ?: return null
    val content = newest.optJSONArray("content") ?: return null
    val texts = objects(content)
      .filter { it.optString("type") == TEXT }
      .map { it.optString("text").trim() }
      .filter { it.isNotEmpty() }
    return texts.joinToString("\n\n").ifEmpty { null }
  }

  private fun objects(array: JSONArray): List<JSONObject> = (0 until array.length()).mapNotNull { array.optJSONObject(it) }

  private const val ASSISTANT = "assistant"
  private const val TEXT = "text"
}
