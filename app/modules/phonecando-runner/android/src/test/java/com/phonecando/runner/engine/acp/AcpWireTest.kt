package com.phonecando.runner.engine.acp

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for the ACP wire: what we send is one line of JSON-RPC with
// the shapes ACP asks for, what the agent sends reads as an answer, a
// request or a notice, lines are cut right however the pipe splits them,
// and the bridge's token goes only where it belongs.
class AcpWireTest {
  @Test fun aRequestIsOneLineOfJsonRpc() {
    val line = AcpWire.request(7, AcpWire.PROMPT, AcpWire.prompt("s1", "two\nlines"))
    assertFalse(line.contains('\n'))
    val o = JSONObject(line)
    assertEquals("2.0", o.getString("jsonrpc"))
    assertEquals(7, o.getInt("id"))
    assertEquals("session/prompt", o.getString("method"))
    val block = o.getJSONObject("params").getJSONArray("prompt").getJSONObject(0)
    assertEquals("text", block.getString("type"))
    assertEquals("two\nlines", block.getString("text"))
  }

  @Test fun initializeOffersNothingButItself() {
    val p = AcpWire.initialize("1.2.3")
    assertEquals(1, p.getInt("protocolVersion"))
    val caps = p.getJSONObject("clientCapabilities")
    assertFalse(caps.getJSONObject("fs").getBoolean("readTextFile"))
    assertFalse(caps.getJSONObject("fs").getBoolean("writeTextFile"))
    assertFalse(caps.getBoolean("terminal"))
    assertFalse(caps.getJSONObject("auth").getBoolean("terminal"))
    assertEquals("phonecando", p.getJSONObject("clientInfo").getString("name"))
    assertEquals("1.2.3", p.getJSONObject("clientInfo").getString("version"))
  }

  @Test fun chatsCarryFolderServersAndMeta() {
    val servers = AcpWire.mcpServers(AcpBridge("http://127.0.0.1:9", "tok"))
    val fresh = AcpWire.sessionNew("/root/projects", servers, JSONObject().put("k", "v"))
    assertEquals("/root/projects", fresh.getString("cwd"))
    assertEquals("v", fresh.getJSONObject("_meta").getString("k"))
    val server = fresh.getJSONArray("mcpServers").getJSONObject(0)
    assertEquals("http", server.getString("type"))
    assertEquals("phonecando", server.getString("name"))
    assertEquals("http://127.0.0.1:9/mcp", server.getString("url"))
    val header = server.getJSONArray("headers").getJSONObject(0)
    assertEquals("Authorization", header.getString("name"))
    assertEquals("Bearer tok", header.getString("value"))
    val reopened = AcpWire.sessionOpen("s1", "/w", AcpWire.mcpServers(null), null)
    assertEquals("s1", reopened.getString("sessionId"))
    assertEquals(0, reopened.getJSONArray("mcpServers").length())
    assertFalse(reopened.has("_meta"))
  }

  @Test fun theBridgeTokenNeverPrints() {
    assertFalse(AcpBridge("http://127.0.0.1:9", "secret-token").toString().contains("secret-token"))
  }

  @Test fun permissionAnswersAndRefusals() {
    assertEquals("selected", AcpWire.permissionSelected("allow").getJSONObject("outcome").getString("outcome"))
    assertEquals("allow", AcpWire.permissionSelected("allow").getJSONObject("outcome").getString("optionId"))
    assertEquals("cancelled", AcpWire.permissionCancelled().getJSONObject("outcome").getString("outcome"))
    val refusal = JSONObject(AcpWire.error("r-1", AcpWire.METHOD_NOT_FOUND, "not offered"))
    assertEquals("r-1", refusal.getString("id"))
    assertEquals(-32601, refusal.getJSONObject("error").getInt("code"))
    val answer = JSONObject(AcpWire.result(4, JSONObject().put("x", 1)))
    assertEquals(4, answer.getInt("id"))
    val cancel = JSONObject(AcpWire.notification(AcpWire.CANCEL, AcpWire.cancel("s1")))
    assertFalse(cancel.has("id"))
    assertEquals("s1", cancel.getJSONObject("params").getString("sessionId"))
  }

  @Test fun theAgentsLinesReadAsMessages() {
    val answer = AcpWire.parse("""{"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn"}}""") as AcpWire.Response
    assertEquals(3L, answer.id)
    assertNull(answer.error)
    assertEquals("end_turn", answer.result.getString("stopReason"))
    val failed = AcpWire.parse("""{"jsonrpc":"2.0","id":"4","error":{"code":-32000,"message":"Authentication required"}}""") as AcpWire.Response
    assertEquals(4L, failed.id)
    assertEquals(AcpError(-32000, "Authentication required"), failed.error)
    val ask = AcpWire.parse("""{"jsonrpc":"2.0","id":"p-9","method":"session/request_permission","params":{"sessionId":"s"}}""") as AcpWire.Request
    assertEquals("p-9", ask.id)
    assertEquals("session/request_permission", ask.method)
    val notice = AcpWire.parse("""{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s"}}""") as AcpWire.Notification
    assertEquals("s", notice.params.getString("sessionId"))
    // A request with a null id is a notice; noise reads as nothing.
    assertTrue(AcpWire.parse("""{"jsonrpc":"2.0","id":null,"method":"x"}""") is AcpWire.Notification)
    assertNull(AcpWire.parse("Loading model…"))
    assertNull(AcpWire.parse("""{"jsonrpc":"2.0","id":"abc","result":{}}"""))
    assertNull(AcpWire.parse("""{"jsonrpc":"2.0"}"""))
  }

  @Test fun linesAreCutHoweverThePipeSplitsThem() {
    val out = ArrayList<String>()
    val lines = AcpWire.Lines(maxChars = 10)
    fun feed(text: String) = lines.feed(text.toCharArray(), text.length, out::add)
    feed("ab")
    feed("c\r\nde\n\nf")
    assertEquals(listOf("abc", "de", ""), out)
    feed("g\n")
    assertEquals("fg", out.last())
    // A line past the limit is dropped whole, and the next one reads.
    out.clear()
    feed("0123456")
    feed("789abc\nok\n")
    assertEquals(listOf("ok"), out)
  }

  @Test fun textOfSkipsNullAndEmpty() {
    val o = JSONObject("""{"a":"x","b":null,"c":"","d":3}""")
    assertEquals("x", o.textOf("a"))
    assertNull(o.textOf("b"))
    assertNull(o.textOf("c"))
    assertNull(o.textOf("d"))
    assertNull(o.textOf("e"))
  }
}
