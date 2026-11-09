package com.phonecando.runner.bridge

import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.bridge.mcp.McpEndpoint
import com.phonecando.runner.bridge.mcp.McpTool

/** One HTTP request; [readBody] runs only once the caller is known and throws [BodyRefused]. */
class BridgeRequest(
  val method: String,
  val path: String,
  /** Names in lower case, as NanoHTTPD gives them. */
  val headers: Map<String, String>,
  val readBody: () -> String,
)

/** The body could not be read (too large, broken); [reply] says so. */
class BodyRefused(val reply: Reply) : Exception(reply.body)

// One request after HTTP framing, in this order: the caller (CallerAuth; a
// missing or unknown token is 401 and nothing else runs, the body is not
// even read), the caller's engine marked used, then /mcp to the MCP
// endpoint and every other path to the router. Both reach a route through
// [dispatch], so a tool called over MCP meets the same gates, handler and
// telemetry count as its HTTP route. Pure: the server reads the body.
class BridgeEntry(
  private val agents: AgentDirectory,
  private val router: BridgeRouter,
  tools: List<McpTool>,
  serverVersion: String,
  private val onCall: (agentId: String) -> Unit,
  private val onRoute: (path: String, status: Int) -> Unit,
) {
  private val mcp = McpEndpoint(tools, serverVersion) { agent, route, body ->
    dispatch(agent, route.method, route.path, body)
  }

  fun handle(request: BridgeRequest): Reply {
    val agent = CallerAuth.caller(request.headers["authorization"], agents)
      ?: return Reply.error(401, "unauthorized", "bad bearer token")
    onCall(agent.id)
    val body = try {
      request.readBody()
    } catch (e: BodyRefused) {
      return e.reply
    }
    if (request.path == McpEndpoint.PATH) return mcp.handle(agent, request.method, request.headers, body)
    return dispatch(agent, request.method, request.path, body)
  }

  private fun dispatch(agent: AgentRecord, method: String, path: String, body: String): Reply {
    val reply = router.handle(agent, method, path, body)
    onRoute(path, reply.status)
    return reply
  }
}
