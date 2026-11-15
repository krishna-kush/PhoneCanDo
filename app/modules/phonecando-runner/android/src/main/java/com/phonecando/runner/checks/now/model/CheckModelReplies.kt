package com.phonecando.runner.checks.now.model

import org.json.JSONArray
import org.json.JSONObject

// What the check model (CheckModel) answers: to every turn the word "done"
// and the turn's end, at once, never a tool call, in the wire API the agent
// speaks: Anthropic Messages (`…/messages`, and `…/count_tokens`), OpenAI
// Chat Completions (`…/chat/completions`) and OpenAI Responses
// (`…/responses`), streamed (server-sent events, sent whole) or not;
// `…/models` lists it. Anything else is a 404. The PC trial kit's scripted
// model, without its tool plan. Pure.
internal object CheckModelReplies {
  /** An HTTP answer: [mime] null for an empty body. */
  data class Reply(val status: Int, val mime: String?, val body: String)

  const val MODEL = "phonecando-check"
  const val TEXT = "done"

  private const val JSON = "application/json"
  private const val EVENTS = "text/event-stream"
  private val NOT_FOUND = Reply(404, null, "")

  /** The answer to [method] [path] with [body] (JSON; anything else reads as {}), the [id]th request. */
  fun reply(method: String, path: String, body: String, id: Int): Reply {
    val route = path.substringBefore('?').trimEnd('/')
    if (method == "GET" && route.endsWith("/models")) return json(models())
    if (method != "POST") return NOT_FOUND
    val request = try {
      JSONObject(body)
    } catch (_: Exception) {
      JSONObject()
    }
    val stream = request.optBoolean("stream", false)
    return when {
      route.endsWith("/count_tokens") -> json(JSONObject().put("input_tokens", 100))
      route.endsWith("/messages") -> anthropic(stream, id)
      route.endsWith("/chat/completions") -> chat(request, stream, id)
      route.endsWith("/responses") -> responses(stream, id)
      else -> NOT_FOUND
    }
  }

  private fun models(): JSONObject {
    val model = JSONObject().put("id", MODEL).put("object", "model").put("type", "model")
      .put("display_name", "PhoneCanDo check").put("created", 0).put("owned_by", "phonecando")
    return JSONObject().put("object", "list").put("data", JSONArray().put(model)).put("has_more", false)
      .put("first_id", MODEL).put("last_id", MODEL)
  }

  private fun anthropic(stream: Boolean, id: Int): Reply {
    val usage = { JSONObject().put("input_tokens", 10).put("output_tokens", 1) }
    val message = { content: JSONArray, stop: Any ->
      JSONObject().put("id", "msg_$id").put("type", "message").put("role", "assistant").put("model", MODEL)
        .put("content", content).put("stop_reason", stop).put("stop_sequence", JSONObject.NULL).put("usage", usage())
    }
    val text = JSONObject().put("type", "text").put("text", TEXT)
    if (!stream) return json(message(JSONArray().put(text), "end_turn"))
    val events = Events()
    events.send("message_start", JSONObject().put("type", "message_start").put("message", message(JSONArray(), JSONObject.NULL)))
    events.send(
      "content_block_start",
      JSONObject().put("type", "content_block_start").put("index", 0).put("content_block", JSONObject().put("type", "text").put("text", "")),
    )
    events.send(
      "content_block_delta",
      JSONObject().put("type", "content_block_delta").put("index", 0).put("delta", JSONObject().put("type", "text_delta").put("text", TEXT)),
    )
    events.send("content_block_stop", JSONObject().put("type", "content_block_stop").put("index", 0))
    events.send(
      "message_delta",
      JSONObject().put("type", "message_delta")
        .put("delta", JSONObject().put("stop_reason", "end_turn").put("stop_sequence", JSONObject.NULL))
        .put("usage", JSONObject().put("output_tokens", 1)),
    )
    events.send("message_stop", JSONObject().put("type", "message_stop"))
    return events.reply()
  }

  private fun chat(request: JSONObject, stream: Boolean, id: Int): Reply {
    val model = request.optString("model").ifEmpty { MODEL }
    val base = { kind: String -> JSONObject().put("id", "chatcmpl-$id").put("object", kind).put("created", 0).put("model", model) }
    val usage = JSONObject().put("prompt_tokens", 10).put("completion_tokens", 1).put("total_tokens", 11)
    if (!stream) {
      val message = JSONObject().put("role", "assistant").put("content", TEXT)
      val choice = JSONObject().put("index", 0).put("message", message).put("finish_reason", "stop")
      return json(base("chat.completion").put("choices", JSONArray().put(choice)).put("usage", usage))
    }
    val events = Events()
    val chunk = { choice: JSONObject -> base("chat.completion.chunk").put("choices", JSONArray().put(choice)) }
    val delta = JSONObject().put("role", "assistant").put("content", TEXT)
    events.send(null, chunk(JSONObject().put("index", 0).put("delta", delta).put("finish_reason", JSONObject.NULL)))
    events.send(null, chunk(JSONObject().put("index", 0).put("delta", JSONObject()).put("finish_reason", "stop")))
    if (request.optJSONObject("stream_options")?.optBoolean("include_usage", false) == true) {
      events.send(null, base("chat.completion.chunk").put("choices", JSONArray()).put("usage", usage))
    }
    events.send(null, "[DONE]")
    return events.reply()
  }

  private fun responses(stream: Boolean, id: Int): Reply {
    val part = { text: String -> JSONObject().put("type", "output_text").put("text", text).put("annotations", JSONArray()) }
    val item = { status: String, content: JSONArray ->
      JSONObject().put("type", "message").put("id", "msg_$id").put("role", "assistant").put("status", status).put("content", content)
    }
    val done = item("completed", JSONArray().put(part(TEXT)))
    val response = { status: String, output: JSONArray ->
      val usage = JSONObject().put("input_tokens", 10).put("input_tokens_details", JSONObject().put("cached_tokens", 0))
        .put("output_tokens", 1).put("output_tokens_details", JSONObject().put("reasoning_tokens", 0)).put("total_tokens", 11)
      JSONObject().put("id", "resp_$id").put("object", "response").put("created_at", 0).put("status", status)
        .put("model", MODEL).put("output", output).put("usage", if (status == "completed") usage else JSONObject.NULL)
    }
    if (!stream) return json(response("completed", JSONArray().put(done)))
    val events = Events()
    var seq = 0
    val send = { type: String, data: JSONObject -> events.send(type, data.put("type", type).put("sequence_number", seq++)) }
    val at = { data: JSONObject -> data.put("item_id", "msg_$id").put("output_index", 0).put("content_index", 0) }
    send("response.created", JSONObject().put("response", response("in_progress", JSONArray())))
    send("response.output_item.added", JSONObject().put("output_index", 0).put("item", item("in_progress", JSONArray())))
    send("response.content_part.added", at(JSONObject().put("part", part(""))))
    send("response.output_text.delta", at(JSONObject().put("delta", TEXT)))
    send("response.output_text.done", at(JSONObject().put("text", TEXT)))
    send("response.content_part.done", at(JSONObject().put("part", part(TEXT))))
    send("response.output_item.done", JSONObject().put("output_index", 0).put("item", done))
    send("response.completed", JSONObject().put("response", response("completed", JSONArray().put(done))))
    return events.reply()
  }

  private fun json(body: JSONObject) = Reply(200, JSON, body.toString())

  // Server-sent events, one after another: an optional event name, then its data.
  private class Events {
    private val out = StringBuilder()

    fun send(event: String?, data: Any) {
      event?.let { out.append("event: ").append(it).append('\n') }
      out.append("data: ").append(data.toString()).append("\n\n")
    }

    fun reply() = Reply(200, EVENTS, out.toString())
  }
}
