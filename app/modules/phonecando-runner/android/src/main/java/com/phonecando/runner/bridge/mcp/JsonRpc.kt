package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.bridge.Reply
import org.json.JSONObject

// JSON-RPC 2.0 framing for /mcp: one message per POST (MCP 2025-06-18 has no
// batches). A request gets its answer in a 200; a message we cannot take at
// all gets a 400 with an id-less error. Pure.
object JsonRpc {
  const val PARSE_ERROR = -32700
  const val INVALID_REQUEST = -32600
  const val METHOD_NOT_FOUND = -32601
  const val INVALID_PARAMS = -32602

  sealed interface Message

  /** A call that wants an answer; [id] is a string or a number. */
  data class Request(val id: Any, val method: String, val params: JSONObject) : Message

  /** A notification or a client's response: nothing to answer (202). */
  data object NoReply : Message

  /** Not a message we can take; [reply] says why. */
  data class Refused(val reply: Reply) : Message

  fun parse(body: String): Message {
    val text = body.trim()
    if (text.startsWith("[")) return Refused(refused(INVALID_REQUEST, "batches are not supported"))
    val json = try {
      JSONObject(text)
    } catch (_: Exception) {
      return Refused(refused(PARSE_ERROR, "body is not a JSON object"))
    }
    if (json.opt("jsonrpc") != "2.0") return Refused(refused(INVALID_REQUEST, "jsonrpc must be \"2.0\""))
    val method = json.opt("method")
    if (method == null) {
      val response = json.has("id") && (json.has("result") || json.has("error"))
      return if (response) NoReply else Refused(refused(INVALID_REQUEST, "no method"))
    }
    if (method !is String) return Refused(refused(INVALID_REQUEST, "method must be a string"))
    if (!json.has("id")) return NoReply
    val id = json.get("id")
    if (id !is String && id !is Number) return Refused(refused(INVALID_REQUEST, "id must be a string or a number"))
    val params = when (val p = json.opt("params")) {
      null, JSONObject.NULL -> JSONObject()
      is JSONObject -> p
      else -> return Refused(error(id, INVALID_PARAMS, "params must be an object"))
    }
    return Request(id, method, params)
  }

  fun result(id: Any, result: JSONObject): Reply =
    Reply(200, JSONObject().put("jsonrpc", "2.0").put("id", id).put("result", result).toString())

  fun error(id: Any, code: Int, message: String): Reply =
    Reply(200, envelope(id, code, message).toString())

  /** A message refused before it could be read as a request: no id to answer. */
  fun refused(code: Int, message: String, status: Int = 400): Reply =
    Reply(status, envelope(JSONObject.NULL, code, message).toString())

  private fun envelope(id: Any, code: Int, message: String): JSONObject = JSONObject()
    .put("jsonrpc", "2.0")
    .put("id", id)
    .put("error", JSONObject().put("code", code).put("message", message))
}
