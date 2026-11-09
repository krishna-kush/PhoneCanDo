package com.phonecando.runner.bridge.mcp

import com.phonecando.runner.bridge.Reply
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// The generated table against this bridge's routes, the body a tool sends,
// and the text a reply becomes (worded as client.ts words it).
class McpToolsTest {
  @Test fun everyToolInTheRepoTableHasItsRoute() {
    val full = RepoTools.parse(full = true)
    val lite = RepoTools.parse(full = false)
    assertTrue(full.size > lite.size)
    // Lite/play serve no tool on a route only full has.
    assertTrue(lite.none { it.route.fullOnly })
    // A GET route takes no body, so its tool sends nothing fixed.
    for (tool in full.filter { it.route.method == "GET" }) assertEquals(0, tool.body(JSONObject()).length())
  }

  @Test fun aRouteThisBridgeLacksIsLeftOut() {
    val table = """{"schema":1,"tools":[
      {"name":"a","description":"d","channel":"all","method":"GET","route":"/ping","body":{},"inputSchema":{"type":"object"}},
      {"name":"b","description":"d","channel":"all","method":"POST","route":"/ping","body":{},"inputSchema":{"type":"object"}},
      {"name":"c","description":"d","channel":"full","method":"POST","route":"/pce/act","body":{},"inputSchema":{"type":"object"}}
    ]}"""
    val skipped = mutableListOf<String>()
    val tools = McpTools.parse(table, full = false) { name, why -> skipped += "$name: $why" }
    assertEquals(listOf("a"), tools.map { it.name })
    assertEquals(listOf("b: no route POST /ping"), skipped)
    assertThrows(IllegalArgumentException::class.java) { McpTools.parse("""{"schema":2,"tools":[]}""", full = true) }
  }

  @Test fun nullArgumentsLeaveTheFixedFields() {
    val ret = RepoTools.parse(full = true).single { it.name == "mobile_return" }
    val body = ret.body(JSONObject().put("tab", JSONObject.NULL))
    assertEquals("home", body.getString("tab"))
  }

  @Test fun replyTextMatchesTheTsClient() {
    val ok = ToolResult.of(Reply.ok(JSONObject().put("p", "</a/b>")))
    assertEquals("""{"p":"</a/b>"}""", ok.getJSONArray("content").getJSONObject(0).getString("text"))
    val busy = JSONObject().put("code", "control_busy").put("holder", "gemini").put("retryAfterMs", 1_500)
    assertEquals(
      "error control_busy: the screen is in use by gemini; try again in about 2s. " +
        "Wait, then call the tool again; do not loop quickly, and tell the user if it stays busy.",
      ToolResult.errorText(busy, 409),
    )
    assertEquals("error 500: unknown", ToolResult.errorText(JSONObject(), 500))
    val broken = ToolResult.of(Reply(502, "<html>"))
    assertEquals("bridge 502: <html>", broken.getJSONArray("content").getJSONObject(0).getString("text"))
    assertTrue(broken.getBoolean("isError"))
  }

  @Test fun jsonTextEscapesLikeJsonStringify() {
    val v = JSONObject().put("s", "q\"b\\n\n\u0001/")
    assertEquals("""{"s":"q\"b\\n\n\u0001/"}""", JsonText.of(v))
  }
}
