package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.bridge.mcp.McpRig.Companion.call
import com.phonecando.runner.bridge.mcp.McpRig.Companion.rpc
import com.phonecando.runner.bridge.Reply
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// /mcp as a client sees it: the lifecycle, the tool list per channel, and
// tool calls that pass or are refused by the router's gates.
class McpEndpointTest {
  private val rig = McpRig()

  private fun result(reply: Reply): JSONObject {
    assertEquals(200, reply.status)
    return JSONObject(reply.body).getJSONObject("result")
  }

  private fun error(reply: Reply): JSONObject = JSONObject(reply.body).getJSONObject("error")

  /** The tool result's one text item, and whether it is an error. */
  private fun text(reply: Reply): Pair<String, Boolean> {
    val r = result(reply)
    val content = r.getJSONArray("content")
    assertEquals(1, content.length())
    assertEquals("text", content.getJSONObject(0).getString("type"))
    return content.getJSONObject(0).getString("text") to r.getBoolean("isError")
  }

  @Test fun initializeDescribesUsAndEchoesTheId() {
    val reply = rig.post(rpc("init-1", "initialize", JSONObject().put("protocolVersion", "2025-11-25")))
    val body = JSONObject(reply.body)
    assertEquals("2.0", body.getString("jsonrpc"))
    assertEquals("init-1", body.get("id"))
    val r = body.getJSONObject("result")
    assertTrue(r.getJSONObject("capabilities").has("tools"))
    assertEquals("phonecando", r.getJSONObject("serverInfo").getString("name"))
    assertEquals("1.2.3", r.getJSONObject("serverInfo").getString("version"))
  }

  @Test fun initializeEchoesAVersionWeKnowElseOurLatest() {
    val agreed = { asked: String? ->
      val params = JSONObject().apply { if (asked != null) put("protocolVersion", asked) }
      result(rig.post(rpc(1, "initialize", params))).getString("protocolVersion")
    }
    for (known in listOf("2025-11-25", "2025-06-18", "2025-03-26")) assertEquals(known, agreed(known))
    assertEquals("2025-11-25", agreed("2026-07-28"))
    assertEquals("2025-11-25", agreed("2024-11-05"))
    assertEquals("2025-11-25", agreed(null))
  }

  // Claude Code 2.1.306 probes a newer protocol before initialize: a 200
  // with -32601 lets it fall back (a 401 or 400 would read as a failure).
  @Test fun theServerDiscoverProbeIsMethodNotFound() {
    val probe = JSONObject()
      .put("jsonrpc", "2.0")
      .put("id", "server-discover-probe-1")
      .put("method", "server/discover")
      .put("params", JSONObject().put("_meta", JSONObject().put("protocolVersion", "2026-07-28")))
      .toString()
    val reply = rig.post(probe, headers = mapOf("mcp-protocol-version" to "2026-07-28"))
    assertEquals(200, reply.status)
    assertEquals("server-discover-probe-1", JSONObject(reply.body).getString("id"))
    assertEquals(JsonRpc.METHOD_NOT_FOUND, error(reply).getInt("code"))
  }

  @Test fun notificationsAndResponsesGet202WithNoBody() {
    val initialized = rig.post("""{"jsonrpc":"2.0","method":"notifications/initialized"}""")
    assertEquals(Reply(202, ""), initialized)
    assertEquals(202, rig.post("""{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":1}}""").status)
    assertEquals(202, rig.post("""{"jsonrpc":"2.0","id":5,"result":{}}""").status)
  }

  @Test fun pingIsEmpty() {
    assertEquals(0, result(rig.post(rpc(1, "ping"))).length())
  }

  @Test fun unknownMethodsAreJsonRpcErrors() {
    val reply = rig.post(rpc(3, "resources/list"))
    assertEquals(200, reply.status)
    assertEquals(3, JSONObject(reply.body).getInt("id"))
    assertEquals(JsonRpc.METHOD_NOT_FOUND, error(reply).getInt("code"))
  }

  @Test fun unreadableMessagesAre400WithoutAnId() {
    for ((body, code) in listOf(
      "{" to JsonRpc.PARSE_ERROR,
      """[{"jsonrpc":"2.0","id":1,"method":"ping"}]""" to JsonRpc.INVALID_REQUEST,
      """{"id":1,"method":"ping"}""" to JsonRpc.INVALID_REQUEST,
      """{"jsonrpc":"2.0","id":null,"method":"ping"}""" to JsonRpc.INVALID_REQUEST,
    )) {
      val reply = rig.post(body)
      assertEquals(body, 400, reply.status)
      assertEquals(body, code, error(reply).getInt("code"))
      assertTrue(body, JSONObject(reply.body).isNull("id"))
    }
  }

  @Test fun onlyPostIsServed() {
    for (method in listOf("GET", "DELETE")) {
      val reply = rig.endpoint.handle(rig.dir.records[0], method, emptyMap(), "{}")
      assertEquals(405, reply.status)
      assertEquals("POST", reply.headers["Allow"])
    }
  }

  @Test fun browserOriginsAreRefused() {
    val ping = rpc(1, "ping")
    assertEquals(403, rig.post(ping, headers = mapOf("origin" to "http://evil.example")).status)
    assertEquals(200, rig.post(ping, headers = mapOf("origin" to "http://127.0.0.1:9998")).status)
    // The version header is not checked: every version is answered alike.
    assertEquals(200, rig.post(ping, headers = mapOf("mcp-protocol-version" to "2025-11-25")).status)
  }

  @Test fun fullListsEveryOneRouteToolAndLiteTheBasicSix() {
    val names = { r: McpRig ->
      val tools = result(r.post(rpc(1, "tools/list"))).getJSONArray("tools")
      (0 until tools.length()).map { tools.getJSONObject(it) }.onEach {
        assertEquals("object", it.getJSONObject("inputSchema").getString("type"))
        assertTrue(it.getString("description").isNotEmpty())
      }.map { it.getString("name") }
    }
    val basic = listOf("mobile_ping", "mobile_battery", "mobile_notify", "mobile_share", "mobile_open", "mobile_clipboard")
    assertEquals(basic, names(McpRig(full = false)))
    val full = names(rig)
    assertTrue(full.containsAll(basic + listOf("mobile_observe", "mobile_act", "mobile_return", "mobile_request_unlock")))
    // Composed in TypeScript (gen-tools-json.mjs leaves them out).
    assertFalse(full.contains("mobile_launch"))
    assertFalse(full.contains("mobile_click"))
  }

  @Test fun anAllowedCallRunsItsRouteWithTheSchemasArguments() {
    val args = JSONObject().put("text", "done").put("title", "build").put("bogus", 1).put("ignored", JSONObject.NULL)
    val (out, isError) = text(rig.post(call(7, "mobile_notify", args)))
    assertFalse(isError)
    assertEquals("/notify", JSONObject(out).getString("route"))
    // JSON.stringify's text: no `\/` escapes in paths.
    assertFalse(out.contains("\\/"))
    assertEquals(1, rig.handled.size)
    val sent = JSONObject(rig.handled[0].removePrefix("a1 /notify "))
    assertEquals(setOf("text", "title"), sent.keys().asSequence().toSet())
  }

  @Test fun fixedFieldsGoWithTheArguments() {
    text(rig.post(call(1, "mobile_return", JSONObject().put("tab", "env").put("notify", false))))
    val sent = JSONObject(rig.handled.single().removePrefix("a1 /app "))
    assertEquals("env", sent.getString("tab"))
    assertTrue(sent.getBoolean("notify"))
    assertEquals("return", sent.getString("reason"))
  }

  @Test fun theLockedSwitchRefusesTheCallAsAToolError() {
    rig.lock.lock()
    val (out, isError) = text(rig.post(call(1, "mobile_notify", JSONObject().put("text", "hi"))))
    assertTrue(isError)
    assertEquals("error automation_off: phone control is locked; unlock it in PhoneCanDo settings", out)
    assertTrue(rig.handled.isEmpty())
    // The prompt that flips it is ungated.
    assertFalse(text(rig.post(call(2, "mobile_request_unlock"))).second)
  }

  @Test fun aMissingServiceIsUnavailable() {
    rig.host.service = false
    val (out, isError) = text(rig.post(call(1, "mobile_describe")))
    assertTrue(isError)
    assertTrue(out, out.startsWith("error automation_unavailable: "))
  }

  @Test fun theScreenLeaseHoldsOverMcpToo() {
    assertFalse(text(rig.post(call(1, "mobile_observe"), agentAt = 0)).second)
    val (out, isError) = text(rig.post(call(2, "mobile_observe"), agentAt = 1))
    assertTrue(isError)
    assertTrue(out, out.startsWith("error control_busy: the screen is in use by opencode; try again in about 30s."))
    assertEquals("a1", rig.lease.holderId())
  }

  @Test fun fullOnlyToolsAreUnknownOnLite() {
    val lite = McpRig(full = false)
    val reply = lite.post(call(4, "mobile_observe"))
    assertEquals(JsonRpc.INVALID_PARAMS, error(reply).getInt("code"))
    assertEquals("unknown tool: mobile_observe", error(reply).getString("message"))
    assertTrue(lite.handled.isEmpty())
    assertNull(lite.lease.holderId())
  }

  @Test fun badParamsAreJsonRpcErrors() {
    val notObject = rig.post(rpc(1, "tools/call", JSONObject().put("name", "mobile_ping").put("arguments", "x")))
    assertEquals(JsonRpc.INVALID_PARAMS, error(notObject).getInt("code"))
    assertEquals(JsonRpc.INVALID_PARAMS, error(rig.post(rpc(2, "tools/call"))).getInt("code"))
    assertTrue(rig.handled.isEmpty())
  }
}
