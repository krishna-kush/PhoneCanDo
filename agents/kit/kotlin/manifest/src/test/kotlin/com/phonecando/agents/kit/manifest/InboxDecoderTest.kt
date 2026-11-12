package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for the `inbox` block (InboxDecoder): every part read with its
// types and defaults, and what it refuses at its JSON pointer.
class InboxDecoderTest {
  private fun decode(inbox: String) = ManifestDecoder.decode(
    """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview","inbox":$inbox}""",
  ).inbox!!

  private fun refused(inbox: String): ManifestException = assertFailsWith { decode(inbox) }

  @Test fun noBlockIsPullOnly() {
    assertNull(ManifestDecoder.decode("""{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview"}""").inbox)
  }

  @Test fun readsHooksInOrder() {
    val inbox = decode(
      """{"hooks":{
           "PostToolUse":{"format":"json","template":{"hookSpecificOutput":{"additionalContext":"{{messages}}"}}},
           "Stop":{"format":"text","template":"{{messages}}","exit":2}},
         "wake":"hook"}""",
    )
    assertEquals(listOf("PostToolUse", "Stop"), inbox.hooks.keys.toList())
    val post = inbox.hooks.getValue("PostToolUse")
    assertEquals(InboxFormat.JSON, post.format)
    assertTrue(post.template is JsonObject)
    assertEquals(0, post.exit)
    assertEquals(InboxHook(InboxFormat.TEXT, JsonPrimitive("{{messages}}"), 2), inbox.hooks["Stop"])
    assertNull(inbox.server)
    assertFalse(inbox.reader)
    assertEquals(InboxWake.HOOK, inbox.wake)
  }

  @Test fun readsServerAndReader() {
    val inbox = decode(
      """{"server":{
           "deliver":{"method":"POST","path":"/s/{{sessionId}}/queue","body":{"text":"{{messages}}"}},
           "wake":{"method":"POST","path":"/s/{{sessionId}}/prompt","body":{"parts":[{"text":"{{messages}}"}]}}},
         "reader":true,"wake":"server"}""",
    )
    val server = inbox.server!!
    assertEquals("/s/{{sessionId}}/queue", server.deliver.path)
    assertEquals("POST", server.wake!!.method)
    assertEquals("""{"parts":[{"text":"{{messages}}"}]}""", server.wake!!.body.toString())
    assertTrue(inbox.reader)
    assertEquals(InboxWake.SERVER, inbox.wake)
    assertTrue(inbox.hooks.isEmpty())
  }

  @Test fun refusesWrongShapes() {
    assertEquals("/inbox/wake", refused("""{"reader":true,"wake":"push"}""").path)
    assertEquals("/inbox/reader", refused("""{"reader":"yes"}""").path)
    assertEquals("/inbox/hooks/Stop/format", refused("""{"hooks":{"Stop":{"template":"{{messages}}"}}}""").path)
    assertEquals("/inbox/hooks/Stop/format", refused("""{"hooks":{"Stop":{"format":"xml","template":"x"}}}""").path)
    assertEquals("/inbox/hooks/Stop/template", refused("""{"hooks":{"Stop":{"format":"text"}}}""").path)
    assertEquals("/inbox/hooks/Stop/template", refused("""{"hooks":{"Stop":{"format":"json","template":["x"]}}}""").path)
    // An object template is JSON.
    val text = refused("""{"hooks":{"Stop":{"format":"text","template":{"a":"{{messages}}"}}}}""")
    assertEquals("/inbox/hooks/Stop/template", text.path)
    assertEquals("/inbox/hooks/Stop/exit", refused("""{"hooks":{"Stop":{"format":"text","template":"x","exit":256}}}""").path)
    assertEquals("/inbox/hooks/Stop/exit", refused("""{"hooks":{"Stop":{"format":"text","template":"x","exit":-1}}}""").path)
    assertEquals("/inbox/server/deliver", refused("""{"server":{"wake":{"method":"POST","path":"/","body":{}}}}""").path)
    assertEquals("/inbox/server/deliver/method", refused("""{"server":{"deliver":{"method":"GET","path":"/","body":{}}}}""").path)
    assertEquals("/inbox/server/deliver/body", refused("""{"server":{"deliver":{"method":"POST","path":"/"}}}""").path)
  }
}
