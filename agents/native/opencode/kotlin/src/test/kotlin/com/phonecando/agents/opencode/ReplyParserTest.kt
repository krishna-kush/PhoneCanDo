package com.phonecando.agents.opencode

import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.render.ManifestKind
import org.json.JSONObject
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNull

// JVM checks for a chat's last reply, through the hook the manifest names,
// on GET /api/session/<id>/message answers shaped as v2.0.26 sends them.
class ReplyParserTest {
  private val parser = checkNotNull(OpencodeHooks.replyParser(OpencodeHooks.REPLY))

  private fun page(vararg messages: String) = """{"data":[${messages.joinToString(",")}],"cursor":{"next":"x"}}"""

  private fun assistant(vararg content: String) =
    """{"id":"msg_2","type":"assistant","agent":"build","model":{"id":"m","providerID":"p"},
       "content":[${content.joinToString(",")}],"time":{"created":1700000000000,"completed":1700000001000}}"""

  private fun text(t: String) = """{"type":"text","text":${JSONObject.quote(t)}}"""

  private val tool = """{"type":"tool","id":"call_1","name":"bash","state":{"status":"completed"},"time":{"created":1}}"""
  private val thinking = """{"type":"reasoning","text":"Let me look."}"""

  @Test fun onlyItsOwnHookName() {
    assertNull(OpencodeHooks.replyParser("other.reply"))
    assertNull(OpencodeHooks.replyParser(OpencodeHooks.EVENTS))
  }

  @Test fun theNewestAssistantMessagesTextIsTheReply() {
    assertEquals("All 12 tests pass.", parser(page(assistant(thinking, text(" All 12 tests pass. ")))))
    // Its text items, joined; reasoning and tool calls left out.
    assertEquals("Ran it.\n\nIt passes.", parser(page(assistant(text("Ran it."), tool, text("It passes."), thinking))))
    // Newest first: the first assistant message is the one.
    assertEquals("new", parser(page(assistant(text("new")), assistant(text("old")))))
    // Other types before it are passed over (no type filter on the path).
    assertEquals("hi", parser(page("""{"id":"msg_3","type":"user","text":"x"}""", assistant(text("hi")))))
  }

  @Test fun noTextIsNoReply() {
    assertNull(parser(page(assistant(tool))))
    assertNull(parser(page(assistant(text("  ")))))
    assertNull(parser(page(assistant())))
    assertNull(parser(page()))
    assertNull(parser(page("""{"id":"msg_1","type":"user","text":"x"}""")))
    assertNull(parser("""{"error":"not found"}"""))
    assertNull(parser("not json"))
    assertNull(parser(""))
  }

  @Test fun theManifestReadsItThroughTheHook() {
    val kind = ManifestKind.of(ManifestDecoder.decode(File(System.getProperty("phonecando.agentJson")).readText()), OpencodeHooks)
    assertEquals("Done.", kind.parseChatReply(page(assistant(text("Done.")))))
    assertNull(kind.parseChatReply(page(assistant(tool))))
  }
}
