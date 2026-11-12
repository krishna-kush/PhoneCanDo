package com.phonecando.runner.bridge.mcp

import org.json.JSONObject

// MCP cannot push into a running chat, so every tool result tells the
// caller when other agents' messages wait for it: one more text item after
// the result, `You have N unread agent messages: call agents_inbox.`
// (counted after the call, so agents_inbox's own result carries it only
// when more are left). Pure.
object UnreadLine {
  fun text(unread: Int): String =
    if (unread == 1) "You have 1 unread agent message: call agents_inbox." else "You have $unread unread agent messages: call agents_inbox."

  /** [result] (a ToolResult) with the line added when [unread] is over 0. */
  fun append(result: JSONObject, unread: Int): JSONObject {
    if (unread <= 0) return result
    result.optJSONArray("content")?.put(JSONObject().put("type", "text").put("text", text(unread)))
    return result
  }
}
