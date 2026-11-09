package com.phonecando.agents.opencode

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.render.ClientContext
import com.phonecando.agents.kit.render.ClientRecipe
import com.phonecando.agents.kit.render.ManifestKind
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNull

// ../agent.json, rendered the way the runner renders it, against what the
// code it replaced produced: Launch.kt, Auth.kt and OpencodeKind.kt (Kotlin)
// and ts/tui.ts (the TUI recipe). Every expected value below was taken from
// that code's output before it was deleted, env order included.
class ManifestGoldenTest {
  private val kind = ManifestKind.of(
    ManifestDecoder.decode(File(System.getProperty("phonecando.agentJson")).readText()),
    OpencodeHooks,
  )
  private val pw = "0123456789abcdef0123456789abcdef"
  private val basic = "b3BlbmNvZGU6MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

  @Test fun launch() {
    val spec = kind.launch(LaunchContext("/lib", File("/home"), File("/tmp"), "4097", pw))
    assertEquals(listOf("/lib/liboc-engine.so", "serve", "--port", "4097", "--hostname", "127.0.0.1"), spec.argv)
    assertEquals(
      listOf(
        "OPENCODE_DISABLE_AUTOUPDATE" to "1",
        "OPENCODE_DISABLE_LSP_DOWNLOAD" to "1",
        "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER" to "true",
        "OPENCODE_SERVER_PASSWORD" to pw,
        "OPENTUI_LIB_PATH" to "/lib/liboc-opentui.so",
      ),
      spec.env.toList(),
    )
  }

  @Test fun probes() {
    val health = kind.healthProbe("4100", pw)
    assertEquals("http://127.0.0.1:4100/api/session", health.url)
    assertEquals(listOf("Authorization" to "Basic $basic"), health.headers.toList())
    assertEquals("GET", health.method)
    val events = kind.eventStream("4100", pw)!!
    assertEquals("http://127.0.0.1:4100/api/event", events.url)
    assertEquals(listOf("Authorization" to "Basic $basic", "Accept" to "text/event-stream"), events.headers.toList())
    val info = kind.sessionInfo("4100", pw, "ses_1")!!
    assertEquals("http://127.0.0.1:4100/api/session/ses_1", info.url)
    assertEquals(listOf("Authorization" to "Basic $basic"), info.headers.toList())
    assertEquals(listOf(pw, basic), kind.passwordForms(pw))
  }

  @Test fun titles() {
    assertEquals("Fix login", kind.parseSessionTitle("""{"data":{"id":"ses_1","title":" Fix login "}}"""))
    assertNull(kind.parseSessionTitle("""{"data":{"id":"ses_1","title":""}}"""))
    assertNull(kind.parseSessionTitle("""{"data":{"id":"ses_1","title":"   "}}"""))
    assertNull(kind.parseSessionTitle("""{"data":{"id":"ses_1"}}"""))
    assertNull(kind.parseSessionTitle("""{"data":null}"""))
    assertNull(kind.parseSessionTitle("""{"title":"top"}"""))
    assertNull(kind.parseSessionTitle("not json"))
    assertNull(kind.parseSessionTitle(""))
  }

  // ts/client.ts pairUrl: POST /api/pair with JSON and Basic auth; the code
  // from {data:{code}} or {code}, encodeURIComponent'd into /auth/connect/.
  @Test fun webPairing() {
    val req = kind.pairRequest("4100", pw)!!
    assertEquals("http://127.0.0.1:4100/api/pair", req.url)
    assertEquals("POST", req.method)
    assertEquals(mapOf("Content-Type" to "application/json", "Authorization" to "Basic $basic"), req.headers)
    assertEquals(
      "http://127.0.0.1:4100/auth/connect/a%20b%2Fc~*'()!%C3%A9%3F%26%3D%2B%23",
      kind.pairUrlFrom("""{"data":{"code":"a b/c~*'()!é?&=+#","expires_in":300}}""", "4100"),
    )
    assertEquals("http://127.0.0.1:4100/auth/connect/k1", kind.pairUrlFrom("""{"code":"k1","expires_in":300}""", "4100"))
    for (empty in listOf("""{"data":{"code":""}}""", """{"data":{}}""", "{}", "")) {
      val e = kotlin.runCatching { kind.pairUrlFrom(empty, "4100") }.exceptionOrNull()
      assertEquals("serve empty pairing code", e?.message)
    }
  }

  @Test fun eventsGoThroughTheHook() {
    assertEquals(
      EventParser.parse("""{"type":"session.text.delta","data":{"sessionID":"ses_1"}}"""),
      kind.parseEvent("""{"type":"session.text.delta","data":{"sessionID":"ses_1"}}"""),
    )
  }

  // ts/tui.ts for libDir /lib, homeDir /files/images/i1/home, projectDir
  // /proj/app, serverUrl http://127.0.0.1:4097 and the password above.
  private fun tuiEnv() = listOf(
    "HOME" to "/files/images/i1/home",
    "TMPDIR" to "/files/images/i1/home",
    "TERM" to "xterm-256color",
    "COLORTERM" to "truecolor",
    "OPENCODE_DISABLE_AUTOUPDATE" to "1",
    "OPENTUI_LIB_PATH" to "/lib/liboc-opentui.so",
    "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER" to "true",
    "OPENCODE_SERVER_PASSWORD" to pw,
  )

  private fun client(sessionId: String?): ClientRecipe = checkNotNull(
    kind.clientRecipe(
      ClientContext(
        libDir = "/lib",
        home = "/files/images/i1/home",
        tmp = "/files/images/i1/tmp",
        serverUrl = "http://127.0.0.1:4097",
        password = pw,
        projectDir = "/proj/app",
        sessionId = sessionId,
      ),
    ),
  )

  @Test fun clientWithASession() {
    val recipe = client("ses_1")
    assertEquals(
      listOf("/lib/liboc-engine.so", "--server", "http://127.0.0.1:4097", "--session", "ses_1", "/proj/app"),
      recipe.cmd,
    )
    assertEquals(tuiEnv(), recipe.env.toList())
    assertEquals("/proj/app", recipe.cwd)
  }

  // ts/tui.ts once more, with phone-shaped paths (the app's own golden run).
  @Test fun clientOnThePhone() {
    val home = "/data/user/0/p/files/images/img1/home"
    fun recipe(sessionId: String?) = checkNotNull(
      kind.clientRecipe(
        ClientContext("/data/app/x/lib/arm64", home, "/data/user/0/p/files/images/img1/tmp", "http://127.0.0.1:41234", "pw-123", "$home/proj", sessionId),
      ),
    )
    val env = listOf(
      "HOME" to home,
      "TMPDIR" to home,
      "TERM" to "xterm-256color",
      "COLORTERM" to "truecolor",
      "OPENCODE_DISABLE_AUTOUPDATE" to "1",
      "OPENTUI_LIB_PATH" to "/data/app/x/lib/arm64/liboc-opentui.so",
      "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER" to "true",
      "OPENCODE_SERVER_PASSWORD" to "pw-123",
    )
    val without = recipe(null)
    assertEquals(listOf("/data/app/x/lib/arm64/liboc-engine.so", "--server", "http://127.0.0.1:41234", "$home/proj"), without.cmd)
    assertEquals(env, without.env.toList())
    assertEquals("$home/proj", without.cwd)
    val with = recipe("ses_abc")
    assertEquals(
      listOf("/data/app/x/lib/arm64/liboc-engine.so", "--server", "http://127.0.0.1:41234", "--session", "ses_abc", "$home/proj"),
      with.cmd,
    )
    assertEquals(env, with.env.toList())
    assertEquals("$home/proj", with.cwd)
  }

  @Test fun clientWithoutASession() {
    for (none in listOf(null, "")) {
      val recipe = client(none)
      assertEquals(listOf("/lib/liboc-engine.so", "--server", "http://127.0.0.1:4097", "/proj/app"), recipe.cmd)
      assertEquals(tuiEnv(), recipe.env.toList())
      assertEquals("/proj/app", recipe.cwd)
    }
  }
}
