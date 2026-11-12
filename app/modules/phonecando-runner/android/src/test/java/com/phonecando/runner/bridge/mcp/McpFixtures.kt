package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.AutomationHost
import com.phonecando.runner.bridge.BridgeRouter
import com.phonecando.runner.bridge.FakeDirectory
import com.phonecando.runner.bridge.Reply
import com.phonecando.runner.bridge.Route
import com.phonecando.runner.bridge.RouteHandler
import com.phonecando.runner.bridge.ScreenLease
import com.phonecando.runner.bridge.agent
import com.phonecando.runner.controllock.unlockedLock
import org.json.JSONObject
import java.io.File

// The repo's generated tool table (agents/shared/phone-tools/tools.json, as
// agents.gradle packages it; the Gradle test task passes the agents folder
// as phonecando.agentsDir) and a real router whose handlers record what
// reached them, so every MCP test passes the same gates an HTTP call does.
object RepoTools {
  val text: String by lazy {
    val root = checkNotNull(System.getProperty("phonecando.agentsDir")) { "phonecando.agentsDir is not set" }
    File(root, "shared/phone-tools/tools.json").readText()
  }

  /** Every tool must load: a table naming a route the bridge lacks fails. */
  fun parse(full: Boolean): List<McpTool> =
    McpTools.parse(text, full) { name, why -> throw AssertionError("$name: $why") }
}

class FakeHost : AutomationHost {
  var service = true
  override val connected get() = service

  override fun describe() = JSONObject().put("ok", true)
  override fun observe(options: JSONObject) = JSONObject().put("ok", true).put("snapshotId", 7)
  override fun act(request: JSONObject) = JSONObject().put("ok", true)
  override fun pack(request: JSONObject) = JSONObject().put("ok", true)
}

class McpRig(full: Boolean = true) {
  var now = 0L
  val host = FakeHost()
  val lock = unlockedLock { now }
  val dir = FakeDirectory(agent("a1", "opencode"), agent("a2", "gemini"))
  val lease = ScreenLease(30_000) { now }

  /** "<agent> <path> <body>" per handled call. */
  val handled = mutableListOf<String>()
  private val echo: RouteHandler = { call ->
    handled += "${call.agent.id} ${call.route.path} ${call.body}"
    Reply.ok(JSONObject().put("route", call.route.path).put("shot", "/data/shot.png"))
  }
  val router = BridgeRouter(full, { if (full) host else null }, lock, lease, { dir.get(it) != null }, Route.entries.associateWith { echo })
  val endpoint = McpEndpoint(RepoTools.parse(full), "1.2.3") { agent, route, body ->
    router.handle(agent, route.method, route.path, body)
  }

  fun post(body: String, agentAt: Int = 0, headers: Map<String, String> = emptyMap()): Reply =
    endpoint.handle(dir.records[agentAt], "POST", headers, body)

  companion object {
    fun rpc(id: Any, method: String, params: JSONObject? = null): String = JSONObject()
      .put("jsonrpc", "2.0")
      .put("id", id)
      .put("method", method)
      .apply { if (params != null) put("params", params) }
      .toString()

    fun call(id: Any, tool: String, arguments: JSONObject = JSONObject()): String =
      rpc(id, "tools/call", JSONObject().put("name", tool).put("arguments", arguments))
  }
}
