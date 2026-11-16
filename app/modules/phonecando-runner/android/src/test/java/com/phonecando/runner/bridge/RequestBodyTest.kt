package com.phonecando.runner.bridge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.IOException

// A body is its Content-Length bytes as UTF-8, whatever charset its
// Content-Type names (or not): non-ASCII text comes through unchanged.
class RequestBodyTest {
  private val text = "Got it — thanks 👍 café naïve Ærø 日本"

  @Test fun nonAsciiTextComesThroughUnchanged() {
    val body = JSONObject().put("to", "Tester").put("text", text).toString()
    val bytes = body.toByteArray(Charsets.UTF_8)
    val read = RequestBody.read(ByteArrayInputStream(bytes), bytes.size.toLong())
    assertEquals(text, JSONObject(read).getString("text"))
  }

  @Test fun itReadsItsLengthAndNoMore() {
    val body = "{\"text\":\"—\"}".toByteArray(Charsets.UTF_8)
    val next = "GET /next HTTP/1.1\r\n".toByteArray(Charsets.UTF_8)
    val input = ByteArrayInputStream(body + next)
    assertEquals("{\"text\":\"—\"}", RequestBody.read(input, body.size.toLong()))
    assertEquals("GET", String(input.readNBytes(3), Charsets.UTF_8))
  }

  @Test fun emptyIsAnEmptyObjectAndAShortBodyIsRefused() {
    assertEquals(RequestBody.EMPTY, RequestBody.read(ByteArrayInputStream(ByteArray(0)), 0))
    assertEquals(RequestBody.EMPTY, RequestBody.read(ByteArrayInputStream("  \n".toByteArray()), 3))
    assertThrows(IOException::class.java) { RequestBody.read(ByteArrayInputStream("{\"a\":1}".toByteArray()), 20) }
  }
}
