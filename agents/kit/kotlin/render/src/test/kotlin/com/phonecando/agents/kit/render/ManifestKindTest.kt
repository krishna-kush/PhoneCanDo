package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.AgentConfig
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.ManifestException
import com.phonecando.agents.kit.manifest.Origin
import com.phonecando.agents.kit.manifest.PtySignal
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for ManifestKind on a made-up kind: what of() refuses, and how
// requests, launches, titles, pairing and idle come out of the data, for a
// server engine and for a TUI one.
class ManifestKindTest {
  private val base = """
    {
      "schema": 1, "id": "demo", "label": "Demo", "version": "1", "type": "native",
      "channels": ["full"], "stability": "preview",
      "config": { "into": ".demo", "keep": ["a.json", "b.json"] },
      "engine": {
        "style": "server",
        "launch": { "argv": ["{{home}}/bin/demo", "--port", "{{port}}", "--tmp", "{{tmp}}"], "env": { "URL": "{{serverUrl}}" } },
        "readiness": { "http": { "path": "/up" } }
      },
      "events": [{ "sse": { "path": "/ev", "parser": "demo.events" } }],
      "chats": { "title": { "http": { "path": "/chats/{{sessionId}}", "json": "/name" } } },
      "idle": { "from": ["events"], "quietSec": 60 },
      "surfaces": { "home": "tui" },
      "hooks": ["demo.events"]
    }
  """.trimIndent()

  private val event = EngineEvent(EngineEvent.Kind.WORKING, "s1")

  private val hooks = object : KindHooks {
    override val id = "demo"

    override fun sseParser(name: String): ((String) -> EngineEvent?)? =
      if (name == "demo.events") { frame -> event.takeIf { frame == "go" } } else null
  }

  // [base] with [patch] merged in at the top level (a null value drops the key).
  private fun manifest(patch: String = "{}"): Manifest {
    val tree = Json.parseToJsonElement(base).jsonObject.toMutableMap()
    for ((k, v) in Json.parseToJsonElement(patch).jsonObject) {
      if (v is JsonNull) tree.remove(k) else tree[k] = v
    }
    return ManifestDecoder.decode(JsonObject(tree).toString())
  }

  private fun kind(patch: String = "{}", with: KindHooks? = hooks) = ManifestKind.of(manifest(patch), with)

  private fun refused(patch: String, with: KindHooks? = hooks): String =
    assertFailsWith<KindException> { kind(patch, with) }.message!!

  @Test fun refusesWhatThisBuildCannotRun() {
    assertEquals("demo: no engine", refused("""{"engine":null}"""))
    assertEquals("demo: a tui engine needs engine.launch", refused("""{"engine":{"style":"tui"}}"""))
    assertEquals(
      "demo: PTY events need a tui engine",
      refused("""{"events":[{"pty":{"rules":[{"on":"bel","event":"waiting"}]}}],"hooks":null}"""),
    )
    assertEquals(
      "demo: a server engine needs engine.launch",
      refused("""{"engine":{"style":"server","readiness":{"http":{"path":"/"}}}}"""),
    )
    assertEquals(
      "demo: a server engine needs engine.readiness.http",
      refused("""{"engine":{"style":"server","launch":{"argv":["x"]}}}"""),
    )
    assertEquals(
      "demo: a web Home needs surfaces.web.pair and surfaces.web.adapter",
      refused("""{"surfaces":{"home":"web","web":{"adapter":{"cssVars":{},"authUrl":"/in/"}}}}"""),
    )
    assertEquals("demo: no hook demo.events, demo.other in this build", refused("""{"hooks":["demo.events","demo.other"]}""", null))
    assertEquals("demo: no hook demo.other in this build", refused("""{"hooks":["demo.other"]}"""))
    assertEquals(
      "demo: no sse parser demo.nope in this build",
      refused("""{"events":[{"sse":{"path":"/ev","parser":"demo.nope"}}]}"""),
    )
    assertEquals(
      "demo: this build reads one event stream per kind",
      refused("""{"events":[{"sse":{"path":"/a","parser":"demo.events"}},{"sse":{"path":"/b","parser":"demo.events"}}]}"""),
    )
    val other = object : KindHooks {
      override val id = "other"
    }
    assertEquals("demo: hooks are other's", refused("{}", other))
  }

  @Test fun aKindWithoutHooksOrEvents() {
    val plain = kind("""{"events":null,"hooks":null}""", null)
    assertNull(plain.eventStream("1", "pw"))
    assertNull(plain.parseEvent("go"))
  }

  @Test fun launchAndConfig() {
    val k = kind()
    assertEquals("Demo", k.displayName)
    assertEquals(AgentConfig("agents/demo/config", ".demo", setOf("a.json", "b.json")), k.config)
    val spec = k.launch(LaunchContext("/lib", File("/h"), File("/t"), "4100", "pw"))
    assertEquals(listOf("/h/bin/demo", "--port", "4100", "--tmp", "/t"), spec.argv)
    assertEquals(mapOf("URL" to "http://127.0.0.1:4100"), spec.env)
    assertNull(kind("""{"config":null}""").config)
  }

  @Test fun requestsWithoutAuth() {
    val k = kind()
    assertEquals("http://127.0.0.1:7/up", k.healthProbe("7", "pw").url)
    assertTrue(k.healthProbe("7", "pw").headers.isEmpty())
    assertEquals(mapOf("Accept" to "text/event-stream"), k.eventStream("7", "pw")!!.headers)
    assertEquals(listOf("pw"), k.passwordForms("pw"))
    assertEquals(event, k.parseEvent("go"))
    assertNull(k.parseEvent("stay"))
  }

  @Test fun chatTitles() {
    val k = kind()
    assertEquals("http://127.0.0.1:7/chats/a%20b%2Fc", k.sessionInfo("7", "pw", "a b/c")!!.url)
    assertEquals("Name", k.parseSessionTitle("""{"name":" Name "}"""))
    assertNull(k.parseSessionTitle("""{"name":" "}"""))
    assertNull(k.parseSessionTitle("""{"other":"x"}"""))
    val untitled = kind("""{"chats":null}""")
    assertNull(untitled.sessionInfo("7", "pw", "s"))
    assertNull(untitled.parseSessionTitle("""{"name":"x"}"""))
  }

  @Test fun noClientOrPairingUnlessTheManifestHasThem() {
    val k = kind()
    assertNull(k.clientRecipe(ClientContext("/lib", "/h", "/t", "", "pw", "/p", null)))
    assertNull(k.pairRequest("7", "pw"))
    assertFailsWith<KindException> { k.pairUrlFrom("""{"code":"x"}""", "7") }
  }

  @Test fun clientCwdDefaultsToTheProject() {
    val k = kind("""{"surfaces":{"home":"tui","terminal":{"client":{"argv":["{{home}}/tui"],"env":{"T":"{{tmp}}"}}}}}""")
    val recipe = k.clientRecipe(ClientContext("/lib", "/h", "/t", "", "pw", "/p", null))!!
    assertEquals(listOf("/h/tui"), recipe.cmd)
    assertEquals(listOf("HOME" to "/h", "TMPDIR" to "/h", "TERM" to "xterm-256color", "COLORTERM" to "truecolor", "T" to "/t"), recipe.env.toList())
    assertEquals("/p", recipe.cwd)
  }

  @Test fun idle() {
    val k = kind()
    val now = 1_000_000L
    assertTrue(k.isIdle(null, null, now), "no activity since start")
    assertTrue(k.isIdle(now - 60_000, now, now), "output is not watched")
    assertEquals(false, k.isIdle(now - 59_999, null, now))
    assertTrue(kind("""{"idle":null}""").isIdle(now, now, now), "no idle rule")
    assertTrue(kind("""{"idle":{"from":[],"quietSec":60}}""").isIdle(now, now, now), "no source to watch")
    val output = kind("""{"idle":{"from":["output"],"quietSec":120}}""")
    assertTrue(output.watchesOutput)
    assertEquals(false, k.watchesOutput)
    assertTrue(output.isIdle(now, now - 120_000, now), "events are not watched")
    assertEquals(false, output.isIdle(null, now - 119_999, now))
    val both = kind("""{"idle":{"from":["events","output"],"quietSec":1}}""")
    assertEquals(false, both.isIdle(now - 5_000, now, now), "one source still active")
    assertTrue(both.isIdle(now - 5_000, null, now))
  }

  @Test fun kindView() {
    val web = kind(
      """{"surfaces":{"home":"web","web":{"pair":{"method":"POST","path":"/p","code":["/c"],"url":"/u/{{code}}"},
         "adapter":{"cssVars":{"--z":"bg","--a":"fg"},"authUrl":"/in/","x":[1]}},"terminal":{"chatTitle":"^T (.+)$"}},
         "signIn":[{"method":"in-ui","note":"n"}]}""",
    )
    val tui = kind()
    val bare = kind("""{"surfaces":null}""")
    val libs = setOf("libdm-engine.so")
    assertEquals(
      """[{"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",""" +
        """"origin":"bundled","isDefault":true,"home":"web",""" +
        """"web":{"adapter":{"cssVars":{"--z":"bg","--a":"fg"},"authUrl":"/in/","x":[1]}},""" +
        """"chatTitle":"^T (.+)$",""" +
        """"signIn":[{"method":"in-ui","note":"n"}],"requiresLinux":false,"commands":[],"families":null,"runtimes":[],"hasInstall":false,""" +
        """"payloadPresent":true,"models":[],"stateFolder":false,"inbox":"pull","canWake":false,"messaging":"none"},""" +
        """{"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",""" +
        """"origin":"bundled","isDefault":true,"home":"tui","web":null,"chatTitle":null,"signIn":[],""" +
        """"requiresLinux":false,"commands":[],"families":null,"runtimes":[],"hasInstall":false,"payloadPresent":true,"models":[],""" +
        """"stateFolder":false,"inbox":"pull","canWake":false,"messaging":"none"}]""",
      KindView.list(listOf(web, tui), "demo", libs::contains),
    )
    assertEquals("false", KindView.of(tui, false, libs::contains)["isDefault"].toString())
    // No surfaces: the TUI is Home.
    assertEquals("\"tui\"", KindView.of(bare, false, libs::contains)["home"].toString())
    // A native kind whose libs this build lacks; an image kind has none to lack.
    val payload = """{"payload":{"libs":[{"name":"libdm-engine.so"},{"name":"libdm-ui.so"}]}}"""
    assertEquals("false", KindView.of(kind(payload), false, libs::contains)["payloadPresent"].toString())
    assertEquals("true", KindView.of(kind(payload), false) { true }["payloadPresent"].toString())
    val image = ManifestKind.of(
      ManifestDecoder.decode(
        """{"schema":1,"id":"user.top","label":"top","version":"1","type":"image","channels":["full","lite"],"stability":"preview",
           "requires":{"linux":"required","commands":["top"]},"install":{"families":["apt","apk"]},
           "versionCheck":{"argv":["top","-v"],"pattern":"(\\S+)$"},
           "engine":{"style":"tui","launch":{"argv":["top"]}},"surfaces":{"home":"tui","chatTitle":"^(.+)$"}}""",
        Origin.USER,
      ),
      null,
    )
    val view = KindView.of(image, false) { false }
    assertEquals(
      listOf("\"user\"", "true", "[\"top\"]", "[\"apt\",\"apk\"]", "[]", "true", "true", "\"^(.+)$\""),
      listOf("origin", "requiresLinux", "commands", "families", "runtimes", "hasInstall", "payloadPresent", "chatTitle").map { view[it].toString() },
    )
  }

  // [base] as a TUI engine: no auth, readiness or event stream of its own.
  private fun tui(patch: String = "{}"): ManifestKind {
    val engine = """{"engine":{"style":"tui","launch":{"argv":["{{home}}/bin/demo","--tmp","{{tmp}}"],"cwd":"{{projectDir}}/work"},
      "resume":{"args":["--continue"]}},"events":null,"chats":null,"hooks":null}"""
    val tree = Json.parseToJsonElement(engine).jsonObject.toMutableMap()
    for ((k, v) in Json.parseToJsonElement(patch).jsonObject) tree[k] = v
    return kind(JsonObject(tree).toString(), null)
  }

  @Test fun refusesWhatATuiEngineCannotHave() {
    assertEquals(
      "demo: a tui engine cannot have engine.auth, engine.readiness.http",
      refused(
        """{"engine":{"style":"tui","launch":{"argv":["x"]},"auth":{"basic":{"user":"u"}},"readiness":{"http":{"path":"/"}}},
           "events":null,"chats":null,"hooks":null}""",
        null,
      ),
    )
    assertEquals(
      "demo: a tui engine cannot have events[].sse, chats.title",
      refused("""{"engine":{"style":"tui","launch":{"argv":["x"]}},"hooks":null}""", null),
    )
    assertEquals(
      "demo: a tui engine cannot have a web Home",
      assertFailsWith<KindException> { tui("""{"surfaces":{"home":"web"}}""") }.message,
    )
    val bad = assertFailsWith<KindException> {
      tui("""{"events":[{"pty":{"rules":[{"on":"osc9","match":"(","event":"waiting"}]}}]}""")
    }.message!!
    assertTrue(bad.startsWith("demo: the pattern ( does not compile"), bad)
    assertFailsWith<KindException> { tui("""{"surfaces":{"home":"tui","chatTitle":"[x"}}""") }
  }

  @Test fun aTuiLaunchRunsInItsCwdAndResumes() {
    val k = tui()
    val ctx = LaunchContext("/lib", File("/h"), File("/t"), "", "pw")
    val first = k.launch(ctx)
    assertEquals(listOf("/h/bin/demo", "--tmp", "/t"), first.argv)
    assertEquals("/h/projects/work", first.cwd)
    assertEquals(listOf("/h/bin/demo", "--tmp", "/t", "--continue"), k.launch(ctx.copy(resume = true)).argv)
    val at = tui("""{"engine":{"style":"tui","launch":{"argv":["a","b"]},"resume":{"args":["resume","--last"],"at":1}}}""")
    assertEquals(listOf("a", "resume", "--last", "b"), at.launch(ctx.copy(resume = true)).argv)
    assertEquals(listOf("a", "b"), at.launch(ctx).argv)
    // No port: a TUI that names one cannot start.
    val port = tui("""{"engine":{"style":"tui","launch":{"argv":["x","{{port}}"]}}}""")
    assertEquals("{{port}} has no value here", assertFailsWith<KindException> { port.launch(ctx) }.message)
    assertEquals("demo: a tui engine has no health probe", assertFailsWith<KindException> { k.healthProbe("", "pw") }.message)
    assertNull(k.eventStream("", "pw"))
    // A server engine that names no cwd runs in HOME.
    assertNull(kind().launch(ctx.copy(port = "1")).cwd)
  }

  @Test fun projectDirIsTheWorkFolderInHome() {
    val launch = """{"engine":{"style":"tui","launch":{"argv":["a","{{projectDir}}"],"env":{"P":"{{projectDir}}"},"cwd":"{{projectDir}}"}}}"""
    val native = tui(launch).launch(LaunchContext("/lib", File("/h"), File("/t"), "", "pw"))
    assertEquals(listOf("a", "/h/projects"), native.argv)
    assertEquals("/h/projects", native.env["P"])
    assertEquals("/h/projects", native.cwd)
    // An image kind's is the guest's: /root/projects, where its image binds home/projects.
    val image = tui(launch.replace("{\"engine\"", "{\"type\":\"image\",\"requires\":{\"linux\":\"required\"},\"engine\""))
      .launch(LaunchContext("/lib", File("/i/home"), File("/i/tmp"), "", "pw", image = File("/i")))
    assertEquals(listOf("/i/shims/sh", "-c", "cd '/root/projects' || exit; exec \"\$0\" \"\$@\"", "a", "/root/projects"), image.argv)
    assertEquals("/root/projects", image.env["P"])
  }

  @Test fun bridgeArgsOnlyWhenTheKindGetsTheBridge() {
    val k = tui("""{"engine":{"style":"tui","launch":{"argv":["a",{"when":"bridgeUrl","args":["--mcp","{{bridgeUrl}}/mcp"]}]}}}""")
    val ctx = LaunchContext("/lib", File("/h"), File("/t"), "", "pw")
    assertEquals(listOf("a"), k.launch(ctx).argv)
    assertEquals(listOf("a", "--mcp", "http://127.0.0.1:9/mcp"), k.launch(ctx.copy(bridgeUrl = "http://127.0.0.1:9")).argv)
  }

  @Test fun anImageKindRunsThroughItsImageShell() {
    val image = tui(
      """{"type":"image","requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["top","-d","1"]},"resume":{"args":["-c"]}}}""",
    )
    val ctx = LaunchContext("/lib", File("/i/home"), File("/i/tmp"), "", "pw", image = File("/i"))
    val inHome = "cd '/root' || exit; exec \"\$0\" \"\$@\""
    assertEquals(listOf("/i/shims/sh", "-c", inHome, "top", "-d", "1"), image.launch(ctx).argv)
    assertEquals(listOf("/i/shims/sh", "-c", inHome, "top", "-d", "1", "-c"), image.launch(ctx.copy(resume = true)).argv)
    assertFailsWith<KindException> { image.launch(ctx.copy(image = null)) }
    // It sees the guest as the machine's terminal does, never the host's
    // spelling of HOME: placeholders, HOME, TMPDIR and its cwd are guest ones.
    assertEquals(mapOf("HOME" to "/root", "TMPDIR" to "/tmp"), image.launch(ctx).env)
    assertNull(image.launch(ctx).cwd, "the process starts in the host HOME; the guest sh changes dir")
    val placed = tui(
      """{"type":"image","requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["demo","{{home}}/x","{{tmp}}"],"env":{"CFG":"{{home}}/.demo"},"cwd":"{{projectDir}}/work"}}}""",
    ).launch(ctx)
    assertEquals(listOf("/i/shims/sh", "-c", "cd '/root/projects/work' || exit; exec \"\$0\" \"\$@\"", "demo", "/root/x", "/tmp"), placed.argv)
    assertEquals(mapOf("CFG" to "/root/.demo", "HOME" to "/root", "TMPDIR" to "/tmp"), placed.env)
    assertEquals(
      "demo: an image kind needs Linux (requires.linux required)",
      assertFailsWith<KindException> { tui("""{"type":"image","engine":{"style":"tui","launch":{"argv":["top"]}}}""") }.message,
    )
    assertEquals(
      "demo: an image kind's argv[0] is a guest command or path, without placeholders",
      assertFailsWith<KindException> {
        tui("""{"type":"image","requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["{{libDir}}/x"]}}}""")
      }.message,
    )
  }

  @Test fun refusesOutOfRangeNumbers() {
    for ((engine, message) in listOf(
      """"readiness":{"output":{"settleMs":60001}}""" to "demo: engine.readiness settleMs must be 0..60000",
      """"readiness":{"output":{"timeoutSec":0}}""" to "demo: engine.readiness timeoutSec must be 1..3600",
      """"readiness":{"alive":{"ms":-1}}""" to "demo: engine.readiness ms must be 0..60000",
      """"resume":{"args":["-c"],"at":0}""" to "demo: engine.resume.at must be 1..256",
    )) {
      assertEquals(message, assertFailsWith<KindException> { tui("""{"engine":{"style":"tui","launch":{"argv":["x"]},$engine}}""") }.message)
    }
  }

  @Test fun tuiReadinessRulesAndTitle() {
    val k = tui(
      """{"events":[{"pty":{"rules":[{"on":"bel","event":"waiting"}]}},{"pty":{"rules":[{"on":"osc777","match":"x","event":"finished"}]}}],
         "surfaces":{"home":"tui","chatTitle":"^(.+)$","terminal":{"chatTitle":"^T (.+)$"}}}""",
    )
    assertEquals(TuiReadiness.Output(400, 60_000), k.tuiReadiness)
    assertEquals(listOf(PtySignal.BEL, PtySignal.OSC777), k.ptyRules.map { it.on })
    assertEquals("^(.+)$", k.chatTitle)
    assertEquals(EngineStyle.TUI, k.style)
    val output = tui("""{"engine":{"style":"tui","launch":{"argv":["x"]},"readiness":{"output":{"timeoutSec":5}}}}""")
    assertEquals(TuiReadiness.Output(400, 5_000), output.tuiReadiness)
    val alive = tui("""{"engine":{"style":"tui","launch":{"argv":["x"]},"readiness":{"alive":{}}}}""")
    assertEquals(TuiReadiness.Alive(1_000), alive.tuiReadiness)
    assertNull(kind().tuiReadiness)
    assertEquals("^T (.+)$", kind("""{"surfaces":{"home":"tui","terminal":{"chatTitle":"^T (.+)$"}}}""").chatTitle)
  }

  // The schema's fixtures: every manifest the TS validator takes loads here
  // (a user-*.json one as origin user), and one it refuses for a rule the
  // phone also keeps is refused here.
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))

  private fun fixture(file: File): ManifestKind {
    val manifest = ManifestDecoder.decode(file.readText(), if (file.name.startsWith("user-")) Origin.USER else Origin.BUNDLED)
    // Every hook the manifest names, as this build would register it.
    val hooks = object : KindHooks {
      override val id = manifest.id

      override fun sseParser(name: String): ((String) -> EngineEvent?)? = if (name in manifest.hooks) { _ -> null } else null
    }
    return ManifestKind.of(manifest, hooks, Runtimes.catalog(fixtures))
  }

  @Test fun validFixturesLoad() {
    val valid = File(fixtures, "valid").listFiles().orEmpty()
    assertTrue(
      valid.map { it.name }.containsAll(listOf("claude-code.json", "codex.json", "gemini-cli.json", "opencode.json", "user-top.json")),
    )
    for (f in valid) fixture(f)
  }

  @Test fun invalidFixturesThePhoneAlsoRefuses() {
    val refused = listOf(
      "not-an-object", "schema-2", "engine-acp", "pty-rule-unknown", "pty-events-on-server", "server-no-readiness",
      "sse-parser-not-hooked", "tui-readiness-http", "tui-with-server-blocks", "web-home-no-adapter", "image-linux-optional",
      "image-argv-host-path", "user-config-dir", "user-hooks", "user-id-without-prefix", "user-native", "user-no-engine", "user-web",
      "hook-events-on-server", "hook-event-unknown", "install-no-version-check", "install-family-unknown", "runtimes-without-install",
      "update-without-install", "install-retries-range", "state-env-empty", "state-without-instructions",
      "state-config-without-config", "user-state-shared", "inbox-server-on-tui", "inbox-template-no-messages",
      "inbox-wake-unsupported", "inbox-json-unquoted",
    )
    for (name in refused) {
      val e = runCatching { fixture(File(fixtures, "invalid/$name.json")) }.exceptionOrNull()
      assertTrue(e is ManifestException || e is KindException, "$name: $e")
    }
  }

  @Test fun theDeviceProofKind() {
    val top = ManifestKind.of(ManifestDecoder.decode(File(fixtures, "valid/user-top.json").readText(), Origin.USER), null)
    assertEquals(TuiReadiness.Alive(500), top.tuiReadiness)
    assertTrue(top.watchesOutput)
  }
}
