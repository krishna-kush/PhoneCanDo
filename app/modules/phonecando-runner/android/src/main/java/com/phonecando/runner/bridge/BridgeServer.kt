package com.phonecando.runner.bridge

import android.util.Log
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.agents.AgentDirectory
import fi.iki.elonen.NanoHTTPD
import java.io.IOException

// Loopback bridge for the agents' mobile_* tools: each engine is a separate
// process, so a local socket is the only shared channel. NanoHTTPD (MIT) does
// the HTTP framing, bound to 127.0.0.1 only (nothing on the network/LAN can
// reach it). Every request needs the bearer token its engine got at launch;
// the token names the calling agent (CallerAuth), and BridgeRouter decides
// the rest.
class BridgeServer private constructor(
  port: Int,
  private val agents: AgentDirectory,
  private val router: BridgeRouter,
  private val onCall: (agentId: String) -> Unit,
) : NanoHTTPD("127.0.0.1", port) {

  override fun serve(session: IHTTPSession): Response {
    val agent = CallerAuth.caller(session.headers["authorization"], agents)
      ?: return respond(Reply.error(401, "unauthorized", "bad bearer token"))
    onCall(agent.id)
    val method = session.method.name
    val body = if (method == "POST") {
      val declared = session.headers["content-length"]?.toLongOrNull() ?: 0L
      if (declared > MAX_BODY) return respond(Reply.error(413, "too_large", "body over $MAX_BODY bytes"))
      try {
        val files = HashMap<String, String>()
        session.parseBody(files)
        files["postData"] ?: "{}"
      } catch (e: Exception) {
        return respond(Reply.badRequest("bad_json", e.message ?: "cannot read body"))
      }
    } else {
      "{}"
    }
    val reply = try {
      router.handle(agent, method, session.uri, body)
    } catch (e: Exception) {
      Log.w(TAG, "$method ${session.uri} failed", e)
      Reply.error(500, "internal", e.message ?: "bridge failure")
    }
    countToolCall(session.uri, reply.status)
    return respond(reply)
  }

  // Telemetry: one call per authorized request to a known route, whatever
  // its outcome (locked, busy, unavailable and failed calls are still
  // calls). A 404 means the route does not exist in this build or for this
  // method, so it is not a tool call.
  private fun countToolCall(path: String, status: Int) {
    if (status == 404) return
    val name = Route.telemetryKey(path) ?: return
    try {
      TelemetryRecorder.toolCall(name)
    } catch (_: Throwable) {
    }
  }

  private fun respond(reply: Reply): Response =
    newFixedLengthResponse(HttpStatus(reply.status), "application/json; charset=utf-8", reply.body)

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
      200 to "OK", 400 to "Bad Request", 401 to "Unauthorized", 403 to "Forbidden",
      404 to "Not Found", 409 to "Conflict", 413 to "Payload Too Large",
      500 to "Internal Server Error", 503 to "Service Unavailable",
    )

    // NanoHTTPD binds in start(), not in the constructor: try each port in
    // turn (BridgePorts) and keep the first that binds.
    fun start(
      ports: List<Int>,
      agents: AgentDirectory,
      router: BridgeRouter,
      onCall: (agentId: String) -> Unit,
    ): BridgeServer? {
      for (port in ports) {
        val server = BridgeServer(port, agents, router, onCall)
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
