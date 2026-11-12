package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.bridge.Reply
import com.phonecando.runner.bridge.Route
import org.json.JSONArray
import org.json.JSONObject

// MCP over Streamable HTTP at POST /mcp, stateless: each POST carries one
// JSON-RPC message and gets one JSON answer (no SSE stream, no session id),
// so any engine that speaks MCP gets the phone tools with its own bridge
// token. Requests: initialize, ping, tools/list and tools/call; any other
// method (Claude Code's server/discover probe among them) is -32601 in a
// 200, so a client falls back instead of seeing a failure. Notifications (notifications/initialized among them)
// and client responses get 202 with no body. GET and DELETE are 405: we
// open no stream and keep no session. tools/call runs the tool's route
// through [call], the router every HTTP route goes through, so the
// channel, the phone-control switch, the service, the screen lease and the
// prompts apply exactly as they do there. Every tool result ends with the
// caller's unread agent messages, when it has any (UnreadLine). Pure.
class McpEndpoint(
  private val tools: List<McpTool>,
  private val serverVersion: String,
  /** The caller's unread agent messages (messages/Mailbox). */
  private val unread: (agentId: String) -> Int = { 0 },
  private val call: (agent: AgentRecord, route: Route, body: String) -> Reply,
) {
  private val byName = tools.associateBy { it.name }

  /** [headers]: names in lower case, as NanoHTTPD gives them. */
  fun handle(agent: AgentRecord, method: String, headers: Map<String, String>, body: String): Reply {
    if (method != "POST") return Reply(405, "", mapOf("Allow" to "POST"))
    if (!McpHeaders.originAllowed(headers["origin"])) {
      return JsonRpc.refused(JsonRpc.INVALID_REQUEST, "origin not allowed", status = 403)
    }
    return when (val message = JsonRpc.parse(body)) {
      is JsonRpc.Refused -> message.reply
      JsonRpc.NoReply -> Reply(202, "")
      is JsonRpc.Request -> request(agent, message)
    }
  }

  private fun request(agent: AgentRecord, r: JsonRpc.Request): Reply = when (r.method) {
    "initialize" -> JsonRpc.result(r.id, initialize(r.params.opt("protocolVersion")))
    "ping" -> JsonRpc.result(r.id, JSONObject())
    "tools/list" -> JsonRpc.result(r.id, JSONObject().put("tools", JSONArray(tools.map { it.listing() })))
    "tools/call" -> toolCall(agent, r)
    else -> JsonRpc.error(r.id, JsonRpc.METHOD_NOT_FOUND, "method not found: ${r.method}")
  }

  private fun initialize(requested: Any?): JSONObject = JSONObject()
    .put("protocolVersion", McpVersion.negotiate(requested))
    .put("capabilities", JSONObject().put("tools", JSONObject().put("listChanged", false)))
    .put("serverInfo", JSONObject().put("name", SERVER_NAME).put("version", serverVersion))

  // An unknown tool (a full-only one on lite/play among them) or arguments
  // that are not an object are protocol errors; everything the route
  // answers, refusals included, is the tool's result (ToolResult).
  private fun toolCall(agent: AgentRecord, r: JsonRpc.Request): Reply {
    val name = r.params.opt("name") as? String
      ?: return JsonRpc.error(r.id, JsonRpc.INVALID_PARAMS, "name is required")
    val tool = byName[name] ?: return JsonRpc.error(r.id, JsonRpc.INVALID_PARAMS, "unknown tool: $name")
    val arguments = when (val a = r.params.opt("arguments")) {
      null, JSONObject.NULL -> JSONObject()
      is JSONObject -> a
      else -> return JsonRpc.error(r.id, JsonRpc.INVALID_PARAMS, "arguments must be an object")
    }
    val reply = call(agent, tool.route, tool.body(arguments).toString())
    return JsonRpc.result(r.id, UnreadLine.append(ToolResult.of(reply), unread(agent.id)))
  }

  companion object {
    const val PATH = "/mcp"
    const val SERVER_NAME = "phonecando"
  }
}
