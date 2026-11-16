package com.phonecando.runner.models.chats

import com.phonecando.runner.models.chats.ChatKeys.Api
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

// A chat's key: the same for every turn of one chat, another for another
// chat, per wire API.
class ChatKeysTest {
  private fun anthropic(system: String, first: String, vararg later: String, mark: Boolean = false): String {
    val cache = if (mark) ""","cache_control":{"type":"ephemeral"}""" else ""
    val turns = later.joinToString("") { """,{"role":"assistant","content":"ok"},{"role":"user","content":"$it"}""" }
    return """{"model":"m","max_tokens":9,"stream":true,"system":[{"type":"text","text":"$system"$cache}],""" +
      """"tools":[{"name":"read","input_schema":{"type":"object"}}],"messages":[{"role":"user","content":[{"type":"text","text":"$first"$cache}]}$turns]}"""
  }

  @Test fun theRoutesThatRunTheModel() {
    assertEquals(Api.ANTHROPIC, ChatKeys.api("POST", "/v1/messages"))
    assertEquals(Api.OPENAI_CHAT, ChatKeys.api("POST", "/v1/chat/completions"))
    assertEquals(Api.OPENAI_CHAT, ChatKeys.api("POST", "/chat/completions/"))
    assertEquals(Api.OPENAI_RESPONSES, ChatKeys.api("POST", "/v1/responses"))
    assertEquals(Api.COMPLETION, ChatKeys.api("POST", "/completion"))
    // Counting tokens, listing models, health, the slots themselves: no slot of their own.
    assertNull(ChatKeys.api("POST", "/v1/messages/count_tokens"))
    assertNull(ChatKeys.api("GET", "/v1/models"))
    assertNull(ChatKeys.api("GET", "/v1/messages"))
    assertNull(ChatKeys.api("POST", "/slots/0"))
  }

  @Test fun everyTurnOfAnAnthropicChatHasItsKeyAndCacheMarksDoNotCount() {
    val first = ChatKeys.key(Api.ANTHROPIC, anthropic("You code.", "fix it"))
    assertEquals(ChatKeys.LENGTH, first!!.length)
    assertEquals(first, ChatKeys.key(Api.ANTHROPIC, anthropic("You code.", "fix it", "and test", "now", mark = true)))
    // A helper agent: its own system prompt; another chat: its own first message.
    assertNotEquals(first, ChatKeys.key(Api.ANTHROPIC, anthropic("You explore.", "fix it")))
    assertNotEquals(first, ChatKeys.key(Api.ANTHROPIC, anthropic("You code.", "write docs")))
    // Another model name, another API: another key.
    assertNotEquals(first, ChatKeys.key(Api.ANTHROPIC, anthropic("You code.", "fix it").replace("\"model\":\"m\"", "\"model\":\"n\"")))
    assertNotEquals(first, ChatKeys.key(Api.OPENAI_CHAT, anthropic("You code.", "fix it")))
  }

  @Test fun openAiChatReadsTheLeadingSystemMessagesAndTheFirstUserMessage() {
    fun chat(system: String, vararg turns: String) =
      """{"model":"m","messages":[{"role":"system","content":"$system"},{"role":"user","content":"${turns[0]}"}""" +
        turns.drop(1).joinToString("") { """,{"role":"assistant","content":"x"},{"role":"user","content":"$it"}""" } + "]}"
    val key = ChatKeys.key(Api.OPENAI_CHAT, chat("Be brief.", "hi"))
    assertEquals(key, ChatKeys.key(Api.OPENAI_CHAT, chat("Be brief.", "hi", "more", "again")))
    assertNotEquals(key, ChatKeys.key(Api.OPENAI_CHAT, chat("Write a title.", "hi")))
    // Key order in the JSON does not matter.
    assertEquals(
      ChatKeys.key(Api.OPENAI_CHAT, """{"model":"m","tools":[{"a":1,"b":2}],"messages":[{"role":"user","content":"q"}]}"""),
      ChatKeys.key(Api.OPENAI_CHAT, """{"messages":[{"content":"q","role":"user"}],"tools":[{"b":2,"a":1}],"model":"m"}"""),
    )
  }

  @Test fun responsesReadInstructionsAndTheFirstInput() {
    val a = ChatKeys.key(Api.OPENAI_RESPONSES, """{"model":"m","instructions":"I","input":[{"role":"user","content":"q"}]}""")
    assertEquals(a, ChatKeys.key(Api.OPENAI_RESPONSES, """{"model":"m","instructions":"I","input":[{"role":"user","content":"q"},{"role":"assistant","content":"a"},{"role":"user","content":"r"}]}"""))
    assertNotEquals(a, ChatKeys.key(Api.OPENAI_RESPONSES, """{"model":"m","instructions":"J","input":[{"role":"user","content":"q"}]}"""))
    assertNotEquals(a, ChatKeys.key(Api.OPENAI_RESPONSES, """{"model":"m","instructions":"I","input":"q"}"""))
  }

  @Test fun aRawCompletionReadsTheHeadOfItsPrompt() {
    val long = "x".repeat(9_000)
    assertEquals(
      ChatKeys.key(Api.COMPLETION, """{"prompt":"${long}a"}"""),
      ChatKeys.key(Api.COMPLETION, """{"prompt":"${long}b"}"""),
    )
    assertNotEquals(ChatKeys.key(Api.COMPLETION, """{"prompt":"a"}"""), ChatKeys.key(Api.COMPLETION, """{"prompt":"b"}"""))
  }

  @Test fun aBodyWeCannotReadHasNoKey() {
    assertNull(ChatKeys.key(Api.ANTHROPIC, "not json"))
    assertNull(ChatKeys.key(Api.ANTHROPIC, "[1,2]"))
  }

  @Test fun theCanonicalFormSortsKeysAndDropsCacheMarks() {
    val json = org.json.JSONObject("""{"b":[1,2.5,"s",null,true],"a":{"cache_control":{"t":1},"z":"q\"x"}}""")
    assertEquals("""{"a":{"z":"q\"x"},"b":[1,2.5,"s",null,true]}""", ChatKeys.canonical(json))
  }
}
