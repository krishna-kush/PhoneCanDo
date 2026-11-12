package com.phonecando.runner.bridge

import android.util.Log
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.bridge.mcp.McpTool
import fi.iki.elonen.NanoHTTPD
import java.io.IOException

// Loopback bridge for the agents' mobile_* tools: each engine is a separate
// process, so a local socket is the only shared channel. NanoHTTPD (MIT) does
// the HTTP framing, bound to 127.0.0.1 only (nothing on the network/LAN can
// reach it). Every request needs the bearer token its engine got at launch;
// the token names the calling agent, and BridgeEntry decides the rest (the
// HTTP routes through BridgeRouter, MCP at /mcp).
class BridgeServer private constructor(
  port: Int,
  agents: AgentDirectory,
  router: BridgeRouter,
  tools: List<McpTool>,
  serverVersion: String,
  onCall: (agentId: String) -> Unit,
  unread: (agentId: String) -> Int,
) : NanoHTTPD("127.0.0.1", port) {
  private val entry = BridgeEntry(agents, router, tools, serverVersion, onCall, unread, ::countToolCall)

  override fun serve(session: IHTTPSession): Response {
    val method = session.method.name
    val request = BridgeRequest(method, session.uri, session.headers) { readBody(session, method) }
    val reply = try {
      entry.handle(request)
    } catch (e: Exception) {
      Log.w(TAG, "$method ${session.uri} failed", e)
      Reply.error(500, "internal", e.message ?: "bridge failure")
    }
    return respond(reply)
  }

  private fun readBody(session: IHTTPSession, method: String): String {
    if (method != "POST") return "{}"
    val declared = session.headers["content-length"]?.toLongOrNull() ?: 0L
    if (declared > MAX_BODY) throw BodyRefused(Reply.error(413, "too_large", "body over $MAX_BODY bytes"))
    return try {
      val files = HashMap<String, String>()
      session.parseBody(files)
      files["postData"] ?: "{}"
    } catch (e: Exception) {
      throw BodyRefused(Reply.badRequest("bad_json", e.message ?: "cannot read body"))
    }
  }

  // Telemetry: one call per authorized request to a known route, whatever
  // its outcome (locked, busy, unavailable and failed calls are still
  // calls), over HTTP or MCP alike. A 404 means the route does not exist in
  // this build or for this method, so it is not a tool call.
  private fun countToolCall(path: String, status: Int) {
    if (status == 404) return
    val name = Route.telemetryKey(path) ?: return
    try {
      TelemetryRecorder.toolCall(name)
    } catch (_: Throwable) {
    }
  }

  // An empty body (202, 405) goes out with no content type.
  private fun respond(reply: Reply): Response {
    val mime = if (reply.body.isEmpty()) null else "application/json; charset=utf-8"
    val response = newFixedLengthResponse(HttpStatus(reply.status), mime, reply.body)
    reply.headers.forEach { (name, value) -> response.addHeader(name, value) }
    return response
  }

  // Any code, not only the ones NanoHTTPD 2.3.1 names (it has no 413).
  private class HttpStatus(private val code: Int) : Response.IStatus {
    override fun getDescription() = "$code ${REASONS[code] ?: "Status"}"

    override fun getRequestStatus() = code
  }

  companion object {
    private const val TAG = "PhoneCanDoBridge"
    private const val TIMEOUT_MS = 10_000
    private const val MAX_BODY = 256L * 1024
    private val REASONS = mapOf(
      200 to "OK", 202 to "Accepted", 400 to "Bad Request", 401 to "Unauthorized", 403 to "Forbidden",
      404 to "Not Found", 405 to "Method Not Allowed", 409 to "Conflict", 413 to "Payload Too Large",
      500 to "Internal Server Error", 503 to "Service Unavailable",
    )

    // NanoHTTPD binds in start(), not in the constructor: try each port in
    // turn (BridgePorts) and keep the first that binds.
    fun start(
      ports: List<Int>,
      agents: AgentDirectory,
      router: BridgeRouter,
      tools: List<McpTool>,
      serverVersion: String,
      onCall: (agentId: String) -> Unit,
      unread: (agentId: String) -> Int = { 0 },
    ): BridgeServer? {
      for (port in ports) {
        val server = BridgeServer(port, agents, router, tools, serverVersion, onCall, unread)
        try {
          server.start(TIMEOUT_MS, false)
          Log.i(TAG, "bridge on 127.0.0.1:${server.listeningPort}")
          return server
        } catch (e: IOException) {
          Log.w(TAG, "bridge bind on $port failed", e)
          server.stop()
        }
      }
      Log.w(TAG, "bridge bind failed")
      return null
    }
  }
}
