package com.phonecando.runner.engine.acp

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for folding a turn's updates into what Home shows: chunks
// merge per message, tool steps keep their last fields, the plan is one
// item, the rest shows nothing, and a turn stays within its limits.
class AcpTurnTest {
  private fun update(json: String) = JSONObject(json)

  private fun text(text: String, messageId: String? = null) = update(
    """{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":${JSONObject.quote(text)}}""" +
      (messageId?.let { ""","messageId":"$it"""" } ?: "") + "}",
  )

  private fun thought(text: String) =
    update("""{"sessionUpdate":"agent_thought_chunk","content":{"type":"text","text":${JSONObject.quote(text)}}}""")

  @Test fun chunksMergeIntoOneMessage() {
    val turn = AcpTurn()
    turn.onUpdate(text("Hel"))
    assertEquals(AcpItem.Text("m1", "Hello"), turn.onUpdate(text("lo")))
    turn.onUpdate(thought("hmm"))
    turn.onUpdate(thought(", yes"))
    turn.onUpdate(text("Next"))
    assertEquals(
      listOf(AcpItem.Text("m1", "Hello"), AcpItem.Thought("t2", "hmm, yes"), AcpItem.Text("m3", "Next")),
      turn.items(),
    )
  }

  @Test fun aMessageIdKeepsItsMessageTogether() {
    val turn = AcpTurn()
    turn.onUpdate(text("a", "x"))
    turn.onUpdate(update("""{"sessionUpdate":"tool_call","toolCallId":"c1","title":"Read","status":"pending"}"""))
    turn.onUpdate(text("b", "x"))
    assertEquals(AcpItem.Text("m:x", "ab"), turn.items().first())
  }

  @Test fun aToolStepKeepsItsLastFields() {
    val turn = AcpTurn()
    turn.onUpdate(update("""{"sessionUpdate":"tool_call","toolCallId":"c1","title":"Run tests","kind":"execute","status":"pending"}"""))
    val done = turn.onUpdate(update("""{"sessionUpdate":"tool_call_update","toolCallId":"c1","status":"completed"}"""))
    assertEquals(AcpItem.Tool("tool:c1", "Run tests", "execute", "completed"), done)
    // An update for a call we never saw still shows.
    assertEquals(
      AcpItem.Tool("tool:c2", "", null, "in_progress"),
      turn.onUpdate(update("""{"sessionUpdate":"tool_call_update","toolCallId":"c2","status":"in_progress"}""")),
    )
  }

  @Test fun thePlanIsOneItem() {
    val turn = AcpTurn()
    turn.onUpdate(update("""{"sessionUpdate":"plan","entries":[{"content":"Read","priority":"high","status":"pending"}]}"""))
    val plan = turn.onUpdate(update("""{"sessionUpdate":"plan","entries":[{"content":"Read"},{"content":"Fix"}]}"""))
    assertEquals(AcpItem.Plan("plan", listOf("Read", "Fix")), plan)
    assertEquals(1, turn.items().size)
  }

  @Test fun otherUpdatesShowNothing() {
    val turn = AcpTurn()
    assertNull(turn.onUpdate(update("""{"sessionUpdate":"usage_update","used":5}""")))
    assertNull(turn.onUpdate(update("""{"sessionUpdate":"user_message_chunk","content":{"type":"text","text":"hi"}}""")))
    assertNull(turn.onUpdate(update("""{"sessionUpdate":"agent_message_chunk","content":{"type":"image","data":"…"}}""")))
    assertNull(turn.onUpdate(update("""{"sessionUpdate":"tool_call"}""")))
    assertEquals(emptyList<AcpItem>(), turn.items())
  }

  @Test fun aTurnStaysWithinItsLimits() {
    val turn = AcpTurn(maxItems = 3, maxChars = 10)
    for (i in 1..5) turn.onUpdate(update("""{"sessionUpdate":"tool_call","toolCallId":"c$i","title":"t$i"}"""))
    assertEquals(listOf("tool:c3", "tool:c4", "tool:c5"), turn.items().map { it.id })
    turn.onUpdate(text("12345678"))
    turn.onUpdate(update("""{"sessionUpdate":"tool_call","toolCallId":"c6","title":"t6"}"""))
    turn.onUpdate(text("abcdef"))
    // Past 10 characters the oldest items go.
    assertEquals(listOf("tool:c6", "m2"), turn.items().map { it.id })
    // One message too long keeps its end.
    val alone = AcpTurn(maxItems = 3, maxChars = 4)
    assertEquals(AcpItem.Text("m1", "6789"), alone.onUpdate(text("0123456789")))
  }

  @Test fun clearStartsANewTurn() {
    val turn = AcpTurn()
    turn.onUpdate(text("old"))
    turn.clear()
    turn.onUpdate(text("new"))
    assertEquals(listOf("new"), turn.items().map { (it as AcpItem.Text).text })
  }

  @Test fun aChatsTitleComesFromItsInfo() {
    assertEquals("Fix login", AcpTurn.titleOf(update("""{"sessionUpdate":"session_info_update","title":"Fix login"}""")))
    assertNull(AcpTurn.titleOf(update("""{"sessionUpdate":"plan","title":"x"}""")))
  }

  @Test fun itemsGoToJsAsMaps() {
    assertEquals(mapOf("id" to "m1", "type" to "text", "text" to "hi"), AcpItem.Text("m1", "hi").toMap())
    assertEquals(
      mapOf("id" to "tool:c", "type" to "tool", "title" to "Read", "kind" to "read", "status" to null),
      AcpItem.Tool("tool:c", "Read", "read", null).toMap(),
    )
    assertEquals(mapOf("id" to "plan", "type" to "plan", "entries" to listOf("a")), AcpItem.Plan("plan", listOf("a")).toMap())
  }
}
