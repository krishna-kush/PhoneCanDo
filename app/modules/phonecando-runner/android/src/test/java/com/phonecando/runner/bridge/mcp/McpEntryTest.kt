package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.bridge.BodyRefused
import com.phonecando.runner.bridge.BridgeEntry
import com.phonecando.runner.bridge.BridgeRequest
import com.phonecando.runner.bridge.Reply
import com.phonecando.runner.bridge.mcp.McpRig.Companion.call
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The way into /mcp: the bearer token first (nothing else runs without
// it), then the same dispatch and telemetry count as the HTTP routes.
class McpEntryTest {
  private val rig = McpRig()
  private val used = mutableListOf<String>()
  private val counted = mutableListOf<String>()
  private val entry = BridgeEntry(rig.dir, rig.router, RepoTools.parse(full = true), "1.2.3", { used += it }) { path, status ->
    counted += "$path $status"
  }
  private var bodyRead = false

  private fun request(token: String?, path: String, body: String, method: String = "POST") = BridgeRequest(
    method,
    path,
    listOfNotNull(token?.let { "authorization" to it }).toMap(),
  ) {
    bodyRead = true
    body
  }

  @Test fun aBadTokenIs401AndRunsNothing() {
    for (token in listOf("Bearer nope", "token-a1", null)) {
      val reply = entry.handle(request(token, "/mcp", call(1, "mobile_ping")))
      assertEquals(401, reply.status)
      assertEquals("unauthorized", JSONObject(reply.body).getString("code"))
    }
    assertFalse(bodyRead)
    assertTrue(used.isEmpty())
    assertTrue(rig.handled.isEmpty())
    assertTrue(counted.isEmpty())
  }

  @Test fun theTokenNamesTheCallerAndTheRouteIsCounted() {
    val reply = entry.handle(request("Bearer token-a2", "/mcp", call(1, "mobile_ping")))
    assertEquals(200, reply.status)
    assertEquals(listOf("a2"), used)
    assertEquals(listOf("a2 /ping {}"), rig.handled)
    assertEquals(listOf("/ping 200"), counted)
  }

  @Test fun lifecycleCallsAreNotToolCalls() {
    entry.handle(request("Bearer token-a1", "/mcp", McpRig.rpc(1, "tools/list")))
    assertTrue(counted.isEmpty())
  }

  @Test fun httpRoutesStillGoToTheRouter() {
    val reply = entry.handle(request("Bearer token-a1", "/ping", "", method = "GET"))
    assertEquals(200, reply.status)
    assertTrue(JSONObject(reply.body).getBoolean("ok"))
    assertEquals(listOf("/ping 200"), counted)
  }

  @Test fun aRefusedBodyIsAnswered() {
    val tooLarge = Reply.error(413, "too_large", "body over 262144 bytes")
    val reply = entry.handle(BridgeRequest("POST", "/mcp", mapOf("authorization" to "Bearer token-a1")) { throw BodyRefused(tooLarge) })
    assertEquals(tooLarge, reply)
  }
}
