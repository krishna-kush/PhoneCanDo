package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.agents.kit.manifest.ManifestDecoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for the inbox (InboxSeam, InboxChecks) on made-up kinds: what a
// hook event prints, the calls a server engine takes, what of() refuses, and
// what KindView tells the app.
class InboxSeamTest {
  // Quotes, a backslash, a line break, a tab, a control character and text
  // that looks like a placeholder: what escaping has to get right.
  private val messages = "<agent-message from=\"A\">\nsay \"hi\"\\ \t\u0001 {{sessionId}}\n</agent-message>"

  private fun tui(inbox: String) = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
         "engine":{"style":"tui","launch":{"argv":["{{home}}/demo"]}},"inbox":$inbox}""",
    ),
    null,
  )

  private fun server(inbox: String, auth: Boolean = true) = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
         "engine":{"style":"server","launch":{"argv":["{{home}}/demo"]},${if (auth) """"auth":{"basic":{"user":"u"}},""" else ""}
         "readiness":{"http":{"path":"/up"}}},"inbox":$inbox}""",
    ),
    null,
  )

  private fun refused(kind: () -> ManifestKind): String = assertFailsWith<KindException> { kind() }.message!!

  @Test fun textHookPrintsTheMessagesAsTheyAre() {
    val kind = tui("""{"hooks":{"Stop":{"format":"text","template":"New messages:\n{{messages}}","exit":2}},"wake":"hook"}""")
    assertEquals("New messages:\n$messages", kind.renderInboxHook("Stop", messages))
    assertEquals(2, kind.inbox!!.hooks.getValue("Stop").exit)
    assertTrue(kind.canWake)
  }

  @Test fun jsonStringTemplateEscapesTheMessages() {
    val kind = tui("""{"hooks":{"AfterTool":{"format":"json","template":"{\"systemMessage\":\"{{messages}}\"}"}}}""")
    val out = kind.renderInboxHook("AfterTool", messages)
    assertEquals(messages, Json.parseToJsonElement(out).jsonObject.getValue("systemMessage").jsonPrimitive.content)
    assertFalse('\n' in out)
    assertFalse(kind.canWake)
  }

  @Test fun jsonObjectTemplateIsSerialisedAfterFilling() {
    val kind = tui(
      """{"hooks":{"PostToolUse":{"format":"json","template":
           {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Agents wrote:\n{{messages}}"},"n":1,"ok":true,"none":null}}}}""",
    )
    val out = Json.parseToJsonElement(kind.renderInboxHook("PostToolUse", messages)).jsonObject
    val inner = out.getValue("hookSpecificOutput").jsonObject
    assertEquals("PostToolUse", inner.getValue("hookEventName").jsonPrimitive.content)
    assertEquals("Agents wrote:\n$messages", inner.getValue("additionalContext").jsonPrimitive.content)
    assertEquals(listOf("1", "true", "null"), listOf("n", "ok", "none").map { out.getValue(it).toString() })
  }

  @Test fun anEventTheInboxDoesNotNameThrows() {
    val kind = tui("""{"hooks":{"Stop":{"format":"text","template":"{{messages}}"}}}""")
    assertEquals("demo: no inbox hook Other", assertFailsWith<KindException> { kind.renderInboxHook("Other", messages) }.message)
  }

  @Test fun serverCallsCarryTheAuthTheChatAndTheMessages() {
    val kind = server(
      """{"server":{
           "deliver":{"method":"POST","path":"/api/session/{{sessionId}}/queue","body":{"text":"{{messages}}","session":"{{sessionId}}"}},
           "wake":{"method":"POST","path":"/api/session/{{sessionId}}/prompt","body":{"parts":[{"type":"text","text":"{{messages}}"}],"n":2}}},
         "wake":"server"}""",
    )
    assertTrue(kind.canWake)
    val deliver = kind.inboxRequest(InboxCall.DELIVER, "4096", "pw", "a b/c", messages)!!
    assertEquals("http://127.0.0.1:4096/api/session/a%20b%2Fc/queue", deliver.url)
    assertEquals("POST", deliver.method)
    assertEquals(
      mapOf("Content-Type" to "application/json", "Authorization" to "Basic ${SecretForms.basicCredential("u", "pw")}"),
      deliver.headers,
    )
    val body = Json.parseToJsonElement(deliver.body).jsonObject
    assertEquals(messages, body.getValue("text").jsonPrimitive.content)
    assertEquals("a b/c", body.getValue("session").jsonPrimitive.content)
    val wake = kind.inboxRequest(InboxCall.WAKE, "4096", "pw", "s1", messages)!!
    assertEquals("http://127.0.0.1:4096/api/session/s1/prompt", wake.url)
    assertEquals("""{"parts":[{"type":"text","text":${JsonPrimitive(messages)}}],"n":2}""", wake.body)
    // Never the password or the messages in a log line.
    assertEquals("InboxRequest(POST http://127.0.0.1:4096/api/session/s1/prompt)", wake.toString())
  }

  @Test fun noCallWithoutAServerBlockACallOrAChat() {
    val deliverOnly = server("""{"server":{"deliver":{"method":"POST","path":"/s/{{sessionId}}","body":{"t":"{{messages}}"}}}}""", auth = false)
    assertNull(deliverOnly.inboxRequest(InboxCall.WAKE, "1", "pw", "s1", messages))
    assertNull(deliverOnly.inboxRequest(InboxCall.DELIVER, "1", "pw", " ", messages))
    assertEquals(mapOf("Content-Type" to "application/json"), deliverOnly.inboxRequest(InboxCall.DELIVER, "1", "pw", "s1", messages)!!.headers)
    // A call that names no chat goes out without one.
    val anyChat = server("""{"server":{"deliver":{"method":"POST","path":"/inbox","body":{"t":"{{messages}}"}}}}""")
    assertEquals("http://127.0.0.1:1/inbox", anyChat.inboxRequest(InboxCall.DELIVER, "1", "pw", "", messages)!!.url)
    assertNull(tui("""{"reader":true}""").inboxRequest(InboxCall.DELIVER, "1", "pw", "s1", messages))
  }

  @Test fun refusesAnInboxItCannotUse() {
    assertEquals("demo: inbox names no way in (hooks, server or reader: true)", refused { tui("{}") })
    assertEquals("demo: inbox names no way in (hooks, server or reader: true)", refused { tui("""{"reader":false,"wake":"reader"}""") })
    assertEquals(
      "demo: ../x is no hook event name (1 to 64 of A-Z a-z 0-9 . _ : -)",
      refused { tui("""{"hooks":{"../x":{"format":"text","template":"{{messages}}"}}}""") },
    )
    assertEquals(
      "demo: inbox.hooks.Stop's template has no {{messages}}",
      refused { tui("""{"hooks":{"Stop":{"format":"text","template":"nothing"}}}""") },
    )
    assertEquals(
      "demo: inbox.hooks.Stop may name {{messages}}, not {{sessionId}}",
      refused { tui("""{"hooks":{"Stop":{"format":"text","template":"{{messages}} {{sessionId}}"}}}""") },
    )
    assertTrue(refused { tui("""{"hooks":{"Stop":{"format":"json","template":"{\"a\": {{messages}}"}}}""") }.startsWith("demo: inbox.hooks.Stop's template is no JSON"))
    // Unquoted (its escapes are no JSON there), or a key: not where a JSON string's content goes.
    assertTrue(refused { tui("""{"hooks":{"Stop":{"format":"json","template":"{\"a\": {{messages}}}"}}}""") }.startsWith("demo: inbox.hooks.Stop's template is no JSON"))
    assertEquals(
      "demo: inbox.hooks.Stop's template puts {{messages}} outside a JSON string",
      refused { tui("""{"hooks":{"Stop":{"format":"json","template":"{\"{{messages}}\": 1}"}}}""") },
    )
    assertEquals(
      "demo: inbox.server needs a server engine",
      refused { tui("""{"server":{"deliver":{"method":"POST","path":"/","body":{"t":"{{messages}}"}}}}""") },
    )
    assertEquals(
      "demo: inbox.server.deliver.body has no {{messages}}",
      refused { server("""{"server":{"deliver":{"method":"POST","path":"/","body":{"t":"x"}}}}""") },
    )
    assertEquals(
      "demo: inbox.server.wake.path may name {{sessionId}}, not {{messages}}",
      refused {
        server(
          """{"server":{"deliver":{"method":"POST","path":"/","body":{"t":"{{messages}}"}},
             "wake":{"method":"POST","path":"/{{messages}}","body":{"t":"{{messages}}"}}}}""",
        )
      },
    )
    assertEquals(
      "demo: inbox.server.deliver.body may name {{messages}}, {{sessionId}}, not {{password}}",
      refused { server("""{"server":{"deliver":{"method":"POST","path":"/","body":{"t":"{{messages}}","p":"{{password}}"}}}}""") },
    )
    assertEquals(
      "demo: inbox.server.deliver.path must be a path on the engine (/…, no spaces)",
      refused { server("""{"server":{"deliver":{"method":"POST","path":"api","body":{"t":"{{messages}}"}}}}""") },
    )
    assertEquals("demo: inbox.wake hook needs inbox.hooks", refused { tui("""{"reader":true,"wake":"hook"}""") })
    assertEquals(
      "demo: inbox.wake server needs inbox.server.wake",
      refused { server("""{"server":{"deliver":{"method":"POST","path":"/","body":{"t":"{{messages}}"}}},"wake":"server"}""") },
    )
    assertEquals(
      "demo: inbox.wake reader needs inbox.reader: true",
      refused { tui("""{"hooks":{"Stop":{"format":"text","template":"{{messages}}"}},"wake":"reader"}""") },
    )
  }

  @Test fun kindViewSaysPushOrPullAndWhetherItWakes() {
    val push = KindView.of(tui("""{"reader":true,"wake":"reader"}"""), false) { true }
    assertEquals(listOf("\"push\"", "true"), listOf(push["inbox"].toString(), push["canWake"].toString()))
    val noWake = KindView.of(tui("""{"reader":true}"""), false) { true }
    assertEquals(listOf("\"push\"", "false"), listOf(noWake["inbox"].toString(), noWake["canWake"].toString()))
    assertEquals(listOf("\"wakes\"", "\"delivered\""), listOf(push["messaging"].toString(), noWake["messaging"].toString()))
  }

  @Test fun theNewestChatLookupCarriesTheAuthAndReadsTheId() {
    val kind = server(
      """{"server":{"deliver":{"method":"POST","path":"/s/{{sessionId}}","body":{"t":"{{messages}}"}},
         "latest":{"path":"/api/session?limit=1&order=desc","id":"/data/0/id"}}}""",
    )
    val get = kind.inboxLatestRequest("4096", "pw")!!
    assertEquals("http://127.0.0.1:4096/api/session?limit=1&order=desc", get.url)
    assertEquals("GET", get.method)
    assertEquals("Basic ${SecretForms.basicCredential("u", "pw")}", get.headers["Authorization"])
    assertEquals("ses_9", kind.inboxLatestId("""{"data":[{"id":"ses_9","title":"x"}]}"""))
    assertNull(kind.inboxLatestId("""{"data":[]}"""))
    assertNull(server("""{"server":{"deliver":{"method":"POST","path":"/s","body":{"t":"{{messages}}"}}}}""").inboxLatestRequest("1", "pw"))
    assertEquals(
      "demo: inbox.server.latest.path must be a path on the engine (/…, no spaces, no placeholders)",
      refused { server("""{"server":{"deliver":{"method":"POST","path":"/s","body":{"t":"{{messages}}"}},"latest":{"path":"/s/{{sessionId}}","id":"/id"}}}""") },
    )
  }

  @Test fun theLevelFollowsToolsInboxAndWake() {
    val wakesByHook = tui("""{"hooks":{"Stop":{"format":"text","template":"{{messages}}","exit":2}},"wake":"hook"}""")
    assertEquals(MessagingLevel.WAKES, wakesByHook.messaging)
    assertTrue(wakesByHook.wakeNeedsWaiter)
    val wakesByServer = server(
      """{"server":{"deliver":{"method":"POST","path":"/q","body":{"t":"{{messages}}"}},
         "wake":{"method":"POST","path":"/w","body":{"t":"{{messages}}"}}},"wake":"server"}""",
    )
    assertEquals(MessagingLevel.WAKES, wakesByServer.messaging)
    assertFalse(wakesByServer.wakeNeedsWaiter)
    assertEquals(MessagingLevel.DELIVERED, tui("""{"hooks":{"AfterTool":{"format":"text","template":"{{messages}}"}}}""").messaging)
    // No inbox: the agents_* tools when it has the phone tools, else nothing.
    val pulls = ManifestKind.of(
      ManifestDecoder.decode(
        """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
           "engine":{"style":"tui","launch":{"argv":["{{home}}/demo"]}},"phoneTools":"mcp:config"}""",
      ),
      null,
    )
    assertEquals(MessagingLevel.INBOX, pulls.messaging)
    val bare = ManifestKind.of(
      ManifestDecoder.decode(
        """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
           "engine":{"style":"tui","launch":{"argv":["{{home}}/demo"]}}}""",
      ),
      null,
    )
    assertEquals(MessagingLevel.NONE, bare.messaging)
    assertFalse(MessagingLevel.NONE.reads)
  }
}
