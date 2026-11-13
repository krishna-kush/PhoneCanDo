package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ManifestDecoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for the call that makes a server kind a new chat
// (`inbox.server.create`): its request, the id read back, what of()
// refuses, and whether a kind runs scheduled tasks (KindView).
class InboxCreateTest {
  private val deliver = """"deliver":{"method":"POST","path":"/s","body":{"t":"{{messages}}"}}"""

  private fun server(server: String, wake: String = "") = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
         "engine":{"style":"server","launch":{"argv":["{{home}}/demo"]},"auth":{"basic":{"user":"u"}},
         "readiness":{"http":{"path":"/up"}}},"inbox":{"server":{$deliver$server}$wake}}""",
    ),
    null,
  )

  private val create = ""","create":{"method":"POST","path":"/api/session","body":{"title":"{{title}}","n":1},"id":"/data/id"}"""

  @Test fun theCreateCallCarriesTheAuthAndTheTitleEscaped() {
    val kind = server(create)
    // Quotes, a line break and text that looks like a placeholder.
    val title = "Scheduled: \"check CI\"\n{{messages}}"
    val post = kind.inboxCreateRequest("4096", "pw", title)!!
    assertEquals("http://127.0.0.1:4096/api/session", post.url)
    assertEquals("POST", post.method)
    assertEquals("application/json", post.headers["Content-Type"])
    assertEquals("Basic ${SecretForms.basicCredential("u", "pw")}", post.headers["Authorization"])
    val body = Json.parseToJsonElement(post.body).jsonObject
    assertEquals(title, body.getValue("title").jsonPrimitive.content)
    assertEquals("1", body.getValue("n").toString())
    assertFalse("pw" in post.toString())
    assertEquals("ses_1", kind.inboxCreatedId("""{"data":{"id":"ses_1","title":"x"}}"""))
    assertNull(kind.inboxCreatedId("""{"data":{"id":""}}"""))
    assertNull(kind.inboxCreatedId("""{"data":{}}"""))
  }

  @Test fun noCreateCallWithoutTheBlock() {
    val kind = server("")
    assertNull(kind.inboxCreateRequest("1", "pw", "t"))
    assertNull(kind.inboxCreatedId("""{"data":{"id":"ses_1"}}"""))
  }

  @Test fun refusesACreateCallItCannotMake() {
    val refused = { server: String -> assertFailsWith<KindException> { server(server) }.message }
    assertEquals(
      "demo: inbox.server.create.path must be a path on the engine (/…, no spaces, no placeholders)",
      refused(""","create":{"method":"POST","path":"/s/{{title}}","body":{},"id":"/id"}"""),
    )
    assertEquals(
      "demo: inbox.server.create.body may name {{title}}, not {{messages}}",
      refused(""","create":{"method":"POST","path":"/s","body":{"t":"{{messages}}"},"id":"/id"}"""),
    )
    assertEquals(
      "demo: inbox.server.create.id must be a JSON pointer (/…)",
      refused(""","create":{"method":"POST","path":"/s","body":{},"id":"data.id"}"""),
    )
  }

  @Test fun aKindRunsSchedulesWhenItStartsWithAPromptOrWakes() {
    assertFalse(server(create).runsSchedules)
    val wakes = server(""","wake":{"method":"POST","path":"/w","body":{"t":"{{messages}}"}}""", wake = ""","wake":"server"""")
    assertTrue(wakes.runsSchedules)
    assertEquals("true", KindView.of(wakes, false) { true }["schedules"].toString())
  }
}
