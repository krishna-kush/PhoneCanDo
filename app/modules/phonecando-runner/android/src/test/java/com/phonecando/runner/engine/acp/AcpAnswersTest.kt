package com.phonecando.runner.engine.acp

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// JVM checks for reading an ACP agent's answers and questions: the newest
// listed chat, the options worth setting, a permission question, why a
// step failed, and why an engine died.
class AcpAnswersTest {
  @Test fun theNewestListedChatWins() {
    val listed = JSONObject(
      """{"sessions":[
        {"sessionId":"a","cwd":"/w","updatedAt":"2026-11-13T10:00:00Z"},
        {"sessionId":"b","cwd":"/w","updatedAt":"2026-11-13T12:00:00+01:00"},
        {"sessionId":"c","cwd":"/w","updatedAt":"2026-11-13T11:30:00Z"},
        {"sessionId":"d","cwd":"/w"}]}""",
    )
    // b is 11:00 UTC: c is newer.
    assertEquals("c", AcpAnswers.newestChat(listed))
    assertEquals("x", AcpAnswers.newestChat(JSONObject("""{"sessions":[{"sessionId":"x"},{"sessionId":"y"}]}""")))
    assertEquals("y", AcpAnswers.newestChat(JSONObject("""{"sessions":[{"sessionId":"x","updatedAt":5},{"sessionId":"y","updatedAt":9}]}""")))
    assertNull(AcpAnswers.newestChat(JSONObject("""{"sessions":[]}""")))
    assertNull(AcpAnswers.newestChat(JSONObject("{}")))
  }

  @Test fun onlyOfferedOptionsAndValuesAreSet() {
    val opened = JSONObject(
      """{"sessionId":"s","configOptions":[
        {"id":"mode","type":"select","currentValue":"auto","options":[{"value":"default","name":"Ask"},{"value":"auto","name":"Auto"}]},
        {"id":"model","type":"select","currentValue":"haiku","options":[{"group":"fast","name":"Fast","options":[{"value":"haiku"},{"value":"flash"}]}]},
        {"id":"effort","type":"select","currentValue":"high","options":[{"value":"high"}]}]}""",
    )
    val wanted = linkedMapOf("mode" to "default", "model" to "flash", "effort" to "high", "theme" to "dark", "x" to "y")
    assertEquals(listOf("mode" to "default", "model" to "flash"), AcpAnswers.optionsToSet(opened, wanted))
    // An agent that offers no options gets none set.
    assertTrue(AcpAnswers.optionsToSet(JSONObject("""{"sessionId":"s"}"""), wanted).isEmpty())
    assertTrue(AcpAnswers.optionsToSet(opened, mapOf("mode" to "plan")).isEmpty())
  }

  @Test fun optionsReadFromHomeGoOverAndNeedOnlyTheOption() {
    val opened = JSONObject(
      """{"sessionId":"s","configOptions":[
        {"id":"mode","type":"select","currentValue":"act","options":[{"value":"plan"},{"value":"act"}]},
        {"id":"model","type":"select","currentValue":"paid/big","options":[{"value":"paid/big"},{"value":"paid/small"}]}]}""",
    )
    // The model its own UI chose is not in its ACP list, and is set anyway; over the manifest's.
    assertEquals(
      listOf("mode" to "plan", "model" to "free/mini"),
      AcpAnswers.optionsToSet(opened, linkedMapOf("mode" to "plan", "model" to "paid/small"), mapOf("model" to "free/mini", "x" to "y")),
    )
    // Already set, or an option it does not offer: nothing.
    assertTrue(AcpAnswers.optionsToSet(opened, emptyMap(), mapOf("model" to "paid/big", "theme" to "dark")).isEmpty())
  }

  @Test fun aPermissionQuestion() {
    val ask = AcpAnswers.permissionAsk(
      "acp-a-1",
      JSONObject(
        """{"sessionId":"s","toolCall":{"toolCallId":"c","title":"mcp__phonecando__agents_list","kind":"other"},
          "options":[{"optionId":"allow","name":"Allow","kind":"allow_once"},{"optionId":"always","name":"Always","kind":"allow_always"},
          {"name":"no id"},{"optionId":"reject","name":"Reject","kind":"reject_once"}]}""",
      ),
    )
    assertEquals("acp-a-1", ask.requestId)
    assertEquals("mcp__phonecando__agents_list", ask.title)
    assertEquals("other", ask.toolKind)
    assertEquals(listOf("allow", "always", "reject"), ask.options.map { it.optionId })
    assertEquals(AcpOption("reject", "Reject", "reject_once"), ask.options.last())
    val bare = AcpAnswers.permissionAsk("acp-a-2", JSONObject("{}"))
    assertEquals("a tool", bare.title)
    assertTrue(bare.options.isEmpty())
    assertEquals(
      mapOf("requestId" to "acp-a-2", "title" to "a tool", "toolKind" to null, "options" to emptyList<Any>()),
      bare.toMap(),
    )
  }

  @Test fun aFailureInPlainWords() {
    val auth = AcpException("session/new", AcpError(AcpWire.AUTH_REQUIRED, "Authentication required"))
    assertTrue(AcpAnswers.failure(auth).startsWith("needs sign-in"))
    assertEquals(
      "its ACP mode failed at initialize: no answer in 90 s",
      AcpAnswers.failure(AcpException("initialize", AcpError(AcpWire.TIMED_OUT, "no answer in 90 s"))),
    )
    assertEquals("its ACP mode failed: boom", AcpAnswers.failure(IllegalStateException("boom")))
  }

  @Test fun aStopReasonAndAChatId() {
    assertEquals("end_turn", AcpAnswers.stopReason(JSONObject("""{"stopReason":"end_turn"}""")))
    assertNull(AcpAnswers.stopReason(JSONObject("{}")))
    assertEquals("s1", AcpAnswers.sessionId(JSONObject("""{"sessionId":"s1"}""")))
  }

  @Test fun whyAnAcpEngineDied() {
    assertEquals("exited with code 1", AcpExit.reason(1, null))
    assertEquals("exited with code 1", AcpExit.reason(1, "\n  \n"))
    assertEquals("exited with code 2: Error: no API key", AcpExit.reason(2, "starting\nError: no API key\n\n"))
    assertEquals(AcpExit.MAX_CHARS + "exited with code 3: ".length, AcpExit.reason(3, "x".repeat(500)).length)
  }
}
