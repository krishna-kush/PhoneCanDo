package com.phonecando.runner.checks.now.model

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// The check model's answers: "done" and the turn's end in each wire API,
// streamed or not, never a tool call; its model list and token count; a 404
// for anything else.
class CheckModelRepliesTest {
  private val tools = """"tools":[{"name":"mcp__phonecando__agents_list","input_schema":{}}]"""

  private fun post(path: String, body: String) = CheckModelReplies.reply("POST", path, body, 7)

  // Server-sent events as (event name or null, data) pairs.
  private fun events(body: String): List<Pair<String?, String>> = body.trim().split("\n\n").map { block ->
    val lines = block.lines()
    lines.firstOrNull { it.startsWith("event: ") }?.removePrefix("event: ") to
      lines.first { it.startsWith("data: ") }.removePrefix("data: ")
  }

  @Test fun anthropicAnswersDoneAndEndsTheTurn() {
    val reply = post("/v1/messages", """{"model":"x","messages":[],$tools}""")
    assertEquals(200, reply.status)
    assertEquals("application/json", reply.mime)
    val message = JSONObject(reply.body)
    assertEquals("end_turn", message.getString("stop_reason"))
    assertEquals(1, message.getJSONArray("content").length())
    assertEquals("text", message.getJSONArray("content").getJSONObject(0).getString("type"))
    assertEquals("done", message.getJSONArray("content").getJSONObject(0).getString("text"))
  }

  @Test fun anthropicStreamed() {
    val reply = post("/v1/messages?beta=true", """{"stream":true,$tools}""")
    assertEquals("text/event-stream", reply.mime)
    val sent = events(reply.body)
    assertEquals(
      listOf("message_start", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"),
      sent.map { it.first },
    )
    assertEquals("done", JSONObject(sent[2].second).getJSONObject("delta").getString("text"))
    assertEquals("end_turn", JSONObject(sent[4].second).getJSONObject("delta").getString("stop_reason"))
  }

  @Test fun chatAnswersDoneWithItsModel() {
    val reply = post("/v1/chat/completions", """{"model":"qwen","messages":[],$tools}""")
    val answer = JSONObject(reply.body)
    assertEquals("qwen", answer.getString("model"))
    val choice = answer.getJSONArray("choices").getJSONObject(0)
    assertEquals("stop", choice.getString("finish_reason"))
    assertEquals("done", choice.getJSONObject("message").getString("content"))
    assertFalse(choice.getJSONObject("message").has("tool_calls"))
  }

  @Test fun chatStreamedEndsWithDone() {
    val plain = events(post("/chat/completions", """{"stream":true}""").body)
    assertEquals(3, plain.size)
    assertEquals("done", JSONObject(plain[0].second).getJSONArray("choices").getJSONObject(0).getJSONObject("delta").getString("content"))
    assertEquals("stop", JSONObject(plain[1].second).getJSONArray("choices").getJSONObject(0).getString("finish_reason"))
    assertEquals("[DONE]", plain.last().second)
    val withUsage = events(post("/v1/chat/completions", """{"stream":true,"stream_options":{"include_usage":true}}""").body)
    assertEquals(4, withUsage.size)
    assertTrue(JSONObject(withUsage[2].second).has("usage"))
  }

  @Test fun responsesAnswersDone() {
    val answer = JSONObject(post("/v1/responses", """{"input":[],$tools}""").body)
    assertEquals("completed", answer.getString("status"))
    val item = answer.getJSONArray("output").getJSONObject(0)
    assertEquals("message", item.getString("type"))
    assertEquals("done", item.getJSONArray("content").getJSONObject(0).getString("text"))
  }

  @Test fun responsesStreamedInOrder() {
    val sent = events(post("/v1/responses", """{"stream":true}""").body)
    assertEquals("response.created", sent.first().first)
    assertEquals("response.completed", sent.last().first)
    assertEquals("done", JSONObject(sent.first { it.first == "response.output_text.delta" }.second).getString("delta"))
    assertEquals(sent.indices.toList(), sent.map { JSONObject(it.second).getInt("sequence_number") })
    sent.forEach { (event, data) -> assertEquals(event, JSONObject(data).getString("type")) }
  }

  @Test fun modelsAndTokenCount() {
    val models = JSONObject(CheckModelReplies.reply("GET", "/v1/models", "", 1).body)
    assertEquals(CheckModelReplies.MODEL, models.getJSONArray("data").getJSONObject(0).getString("id"))
    assertEquals(100, JSONObject(post("/v1/messages/count_tokens", "{}").body).getInt("input_tokens"))
  }

  @Test fun anythingElseIsNotFound() {
    assertEquals(404, CheckModelReplies.reply("GET", "/v1/messages", "", 1).status)
    assertEquals(404, post("/v1/embeddings", "{}").status)
    // A body that is not JSON reads as {}: not streamed.
    assertEquals("application/json", post("/v1/messages/", "not json").mime)
  }
}
