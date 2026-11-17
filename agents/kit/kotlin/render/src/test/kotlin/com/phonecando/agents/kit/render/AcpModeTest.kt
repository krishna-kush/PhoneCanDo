package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.manifest.ManifestDecoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for a tui kind's ACP mode (`engine.acp`): its launch through
// the terminal launch's steps (state env, model, image), its meta and
// options, the chat args a terminal launch opens a chat with, what it makes
// of messaging and schedules, and what of() refuses.
class AcpModeTest {
  // A native TUI kind with phone tools, an own state folder, a local model and an ACP mode.
  private val base = """
    {
      "schema": 1, "id": "demo", "label": "Demo", "version": "1", "type": "native",
      "channels": ["full"], "stability": "preview",
      "state": { "env": { "DEMO_HOME": "{{stateDir}}", "SHARED": "{{stateDir}}/s" } },
      "engine": {
        "style": "tui",
        "launch": { "argv": ["{{libDir}}/demo", "--tui"], "env": { "DEMO_CFG": "{{home}}/.demo", "SHARED": "launch" }, "cwd": "{{projectDir}}" },
        "resume": { "args": ["--continue"], "at": 1 },
        "prompt": { "args": ["{{prompt}}"] },
        "acp": {
          "argv": ["{{libDir}}/demo", "acp", { "when": "bridgeUrl", "args": ["--mcp", "{{bridgeUrl}}/mcp"] }],
          "env": { "DEMO_ACP": "{{tmp}}/acp", "SHARED": "acp", "MODEL": "acp" },
          "options": { "mode": "default", "model": "fast" },
          "meta": { "demo": { "settings": "{{home}}/.demo/settings.json", "tries": 2, "list": ["{{projectDir}}", true, null] } },
          "chat": { "args": ["--chat", "{{chatId}}"], "at": 1 }
        }
      },
      "models": { "openai-chat": { "env": { "MODEL": "{{model}}" }, "args": ["--model", "{{model}}"] } },
      "phoneTools": "mcp:argv"
    }
  """.trimIndent()

  // [base] with [patch] merged in at the top level (a null value drops the key).
  private fun kind(patch: String = "{}"): ManifestKind {
    val tree = Json.parseToJsonElement(base).jsonObject.toMutableMap()
    for ((k, v) in Json.parseToJsonElement(patch).jsonObject) {
      if (v is JsonNull) tree.remove(k) else tree[k] = v
    }
    return ManifestKind.of(ManifestDecoder.decode(JsonObject(tree).toString()), null)
  }

  // [base]'s engine with [acp] as its ACP block.
  private fun withAcp(acp: String) = kind(
    """{"engine":{"style":"tui","launch":{"argv":["demo","--tui"],"cwd":"{{projectDir}}"},"resume":{"args":["--continue"],"at":1},"acp":$acp}}""",
  )

  private fun refused(patch: String): String = assertFailsWith<KindException> { kind(patch) }.message!!

  private val ctx = LaunchContext("/lib", File("/h"), File("/t"), "", "pw")
  private val model = ModelEndpoint("http://127.0.0.1:8080/v1", "qwen", "k", 4096, listOf("openai-chat"))

  @Test fun anAcpLaunchIsTheTerminalLaunchWithItsOwnArgv() {
    val spec = kind().acpLaunch(ctx)!!
    assertEquals(listOf("/lib/demo", "acp"), spec.argv)
    // The launch env, then its own on top.
    assertEquals(listOf("DEMO_CFG" to "/h/.demo", "SHARED" to "acp", "DEMO_ACP" to "/t/acp", "MODEL" to "acp"), spec.env.toList())
    // No own cwd: the launch's.
    assertEquals("/h/projects", spec.cwd)
    // The bridge's args drop in only with a bridge.
    assertEquals(listOf("/lib/demo", "acp", "--mcp", "http://127.0.0.1:9/mcp"), kind().acpLaunch(ctx.copy(bridgeUrl = "http://127.0.0.1:9"))!!.argv)
  }

  @Test fun noResumePromptOrChatArgsInAcpMode() {
    val spec = kind().acpLaunch(ctx.copy(resume = true, prompt = "do it", chatId = "c1"))!!
    assertEquals(listOf("/lib/demo", "acp"), spec.argv)
  }

  @Test fun itsEnvGoesOnTopOfTheStateEnvAndTheModel() {
    val own = kind().acpLaunch(ctx.copy(stateDir = File("/h/.phonecando/agents/a2"), model = model))!!
    // Model args right after the program, as in the terminal launch.
    assertEquals(listOf("/lib/demo", "--model", "qwen", "acp"), own.argv)
    assertEquals(
      listOf("DEMO_CFG" to "/h/.demo", "SHARED" to "acp", "DEMO_HOME" to "/h/.phonecando/agents/a2", "MODEL" to "acp", "DEMO_ACP" to "/t/acp"),
      own.env.toList(),
    )
    // Without its own, the state env wins over the launch's, as in the terminal launch.
    val plain = withAcp("""{"argv":["demo","acp"]}""").acpLaunch(ctx.copy(stateDir = File("/h/.phonecando/agents/a2")))!!
    assertEquals("/h/.phonecando/agents/a2/s", plain.env["SHARED"])
  }

  @Test fun anImageKindRunsItThroughItsImageShell() {
    val image = kind(
      """{"type":"image","requires":{"linux":"required"},"models":null,
         "engine":{"style":"tui","launch":{"argv":["demo"],"env":{"CFG":"{{home}}/.demo"},"cwd":"{{projectDir}}"},
         "acp":{"argv":["demo","--acp","{{tmp}}"],"env":{"LOG":"{{tmp}}/acp.log"},"meta":{"s":"{{home}}/s.json"}}}}""",
    )
    val inImage = LaunchContext("/lib", File("/i/home"), File("/i/tmp"), "", "pw", image = File("/i"), carry = setOf("PHONECANDO_BRIDGE_URL"))
    val spec = image.acpLaunch(inImage.copy(stateDir = File("/i/home/.phonecando/agents/a2")))!!
    assertEquals(
      listOf(
        "/i/shims/sh",
        "-c",
        "cd '/root/projects' || exit; PHONECANDO_BRIDGE_URL=\"\$PHONECANDO_CARRY_PHONECANDO_BRIDGE_URL\"; export PHONECANDO_BRIDGE_URL; " +
          "unset PHONECANDO_CARRY_PHONECANDO_BRIDGE_URL; ${ImageLaunch.EXEC}",
        "demo",
        "--acp",
        "/tmp",
      ),
      spec.argv,
    )
    assertEquals(
      listOf(
        "CFG" to "/root/.demo",
        "DEMO_HOME" to "/root/.phonecando/agents/a2",
        "SHARED" to "/root/.phonecando/agents/a2/s",
        "LOG" to "/tmp/acp.log",
        "HOME" to "/root",
        "TMPDIR" to "/tmp",
      ),
      spec.env.toList(),
    )
    assertNull(spec.cwd)
    // Its meta sees the guest too.
    assertEquals("""{"s":"/root/s.json"}""", image.acpMeta(inImage))
    assertFailsWith<KindException> { image.acpLaunch(inImage.copy(image = null)) }
  }

  @Test fun metaOptionsAndTools() {
    val k = kind()
    assertEquals(
      """{"demo":{"settings":"/h/.demo/settings.json","tries":2,"list":["/h/projects",true,null]}}""",
      k.acpMeta(ctx),
    )
    assertEquals(listOf("mode" to "default", "model" to "fast"), k.acpOptions.toList())
    assertTrue(k.acpBridgeInSession, "session is the default")
    assertFalse(withAcp("""{"argv":["demo"],"tools":"config"}""").acpBridgeInSession)
    assertNull(withAcp("""{"argv":["demo"]}""").acpMeta(ctx))
    // A meta value is filled once: a value that looks like a placeholder stays as it is.
    assertEquals("""{"p":"{{home}}"}""", withAcp("""{"argv":["demo"],"meta":{"p":"{{password}}"}}""").acpMeta(ctx.copy(password = "{{home}}")))
  }

  @Test fun anOptionsHookReadsHomeAtEachAsk() {
    val hooks = object : KindHooks {
      override val id = "demo"
      var calls = 0

      override fun acpOptions(name: String): ((File) -> Map<String, String>)? = if (name != "demo.pick") null else { home ->
        calls++
        when (home.name) {
          "broken" -> throw IllegalStateException("bad file")
          "many" -> (1..12).associate { "o$it" to "v" } + ("" to "x")
          else -> mapOf("model" to "free/${home.name}")
        }
      }
    }
    fun withHook(hook: String, listed: List<String>) = ManifestKind.of(
      ManifestDecoder.decode(
        base.replace("\"options\": {", "\"optionsHook\": \"$hook\", \"options\": {")
          .replace("\"phoneTools\"", "\"hooks\": [${listed.joinToString { "\"$it\"" }}], \"phoneTools\""),
      ),
      hooks,
    )
    val k = withHook("demo.pick", listOf("demo.pick"))
    assertEquals(mapOf("model" to "free/a"), k.acpHomeOptions(File("/h/a")))
    assertEquals(mapOf("model" to "free/b"), k.acpHomeOptions(File("/h/b")))
    assertEquals(2, hooks.calls)
    // A hook that throws sets nothing; at most 8, none with an empty id.
    assertEquals(emptyMap(), k.acpHomeOptions(File("/h/broken")))
    assertEquals((1..8).map { "o$it" }, k.acpHomeOptions(File("/h/many")).keys.toList())
    // The manifest's own options are still the static ones; a kind without a hook reads nothing.
    assertEquals(listOf("mode" to "default", "model" to "fast"), k.acpOptions.toList())
    assertEquals(emptyMap(), kind().acpHomeOptions(File("/h/a")))
    // The hook must be listed, and this build must have it.
    assertEquals("demo: engine.acp.optionsHook demo.pick is not in hooks", assertFailsWith<KindException> { withHook("demo.pick", emptyList()) }.message)
    assertEquals("demo: no hook demo.other in this build", assertFailsWith<KindException> { withHook("demo.other", listOf("demo.other")) }.message)
  }

  @Test fun aKindWithoutAnAcpModeHasNone() {
    val plain = kind("""{"engine":{"style":"tui","launch":{"argv":["demo"]}}}""")
    assertFalse(plain.speaksAcp)
    assertNull(plain.acpLaunch(ctx))
    assertNull(plain.acpMeta(ctx))
    assertFalse(plain.acpBridgeInSession)
    assertEquals(emptyMap(), plain.acpOptions)
    assertFalse(plain.opensChat)
    assertFalse(plain.runsSchedules)
    // A chat id it cannot open: the resume args as usual.
    assertEquals(listOf("demo"), plain.launch(ctx.copy(chatId = "c1")).argv)
  }

  @Test fun aTerminalLaunchOpensTheGivenChatInsteadOfTheNewest() {
    val k = kind()
    assertTrue(k.opensChat)
    assertEquals(listOf("/lib/demo", "--continue", "--tui"), k.launch(ctx.copy(resume = true)).argv)
    // The chat args take the resume args' place, whether or not it ran before.
    assertEquals(listOf("/lib/demo", "--chat", "c 1", "--tui"), k.launch(ctx.copy(resume = true, chatId = "c 1")).argv)
    assertEquals(listOf("/lib/demo", "--chat", "c 1", "--tui"), k.launch(ctx.copy(chatId = "c 1")).argv)
    // The prompt args still apply; the chat id is one item, never read for placeholders.
    assertEquals(
      listOf("/lib/demo", "--chat", "{{home}}", "--tui", "task"),
      k.launch(ctx.copy(resume = true, chatId = "{{home}}", prompt = "task")).argv,
    )
    // Where they meet, the chat args come first.
    val same = kind(
      """{"engine":{"style":"tui","launch":{"argv":["demo","--tui"]},"prompt":{"args":["{{prompt}}"]},
         "acp":{"argv":["demo"],"chat":{"args":["{{chatId}}"]}}}}""",
    )
    assertEquals(listOf("demo", "--tui", "c1", "task"), same.launch(ctx.copy(chatId = "c1", prompt = "task")).argv)
  }

  @Test fun anAcpKindCanBeMessagedAndRunSchedules() {
    val k = kind()
    assertTrue(k.speaksAcp)
    assertEquals(MessagingLevel.WAKES, k.messaging)
    assertFalse(k.canWake, "canWake stays the manifest's inbox.wake")
    assertTrue(k.runsSchedules)
    val noPrompt = withAcp("""{"argv":["demo"]}""")
    assertFalse(noPrompt.promptsAtStart)
    assertTrue(noPrompt.runsSchedules)
    val view = KindView.of(k, false) { true }
    assertEquals(listOf("true", "\"wakes\"", "true"), listOf("acp", "messaging", "schedules").map { view[it].toString() })
  }

  @Test fun refusesWhatItCannotRun() {
    assertEquals(
      "demo: an ACP mode needs a tui engine",
      refused(
        """{"state":null,"engine":{"style":"server","launch":{"argv":["demo"]},"readiness":{"http":{"path":"/"}},"acp":{"argv":["demo"]}}}""",
      ),
    )
    fun acp(block: String) = assertFailsWith<KindException> { withAcp(block) }.message!!
    assertEquals("demo: engine.acp.argv starts with its program", acp("""{"argv":[]}"""))
    assertEquals("demo: engine.acp.argv starts with its program", acp("""{"argv":[{"when":"bridgeUrl","args":["x"]}]}"""))
    assertEquals("demo: engine.acp.argv cannot name {{prompt}}", acp("""{"argv":["demo","{{prompt}}"]}"""))
    assertEquals("demo: engine.acp.argv cannot name {{chatId}}", acp("""{"argv":["demo","--chat={{chatId}}"]}"""))
    assertEquals("demo: engine.acp.argv cannot name {{password}}", acp("""{"argv":["demo",{"when":"bridgeUrl","args":["{{password}}"]}]}"""))
    assertEquals("demo: engine.acp.env cannot name {{stateDir}}", acp("""{"argv":["demo"],"env":{"A":"{{stateDir}}"}}"""))
    assertEquals("demo: engine.acp.meta cannot name {{chatId}}", acp("""{"argv":["demo"],"meta":{"a":["{{chatId}}"]}}"""))
    assertEquals("demo: engine.acp.meta is at most 4 KiB", acp("""{"argv":["demo"],"meta":{"a":"${"x".repeat(4096)}"}}"""))
    val nine = (1..9).joinToString(",") { "\"o$it\":\"v\"" }
    assertEquals("demo: engine.acp.options sets at most 8", acp("""{"argv":["demo"],"options":{$nine}}"""))
    assertEquals(
      "demo: engine.acp.options mode: an id and a value of 1 to 64 characters",
      acp("""{"argv":["demo"],"options":{"mode":""}}"""),
    )
    val once = "demo: engine.acp.chat.args holds {{chatId}} as one whole arg, once"
    assertEquals(once, acp("""{"argv":["demo"],"chat":{"args":["--chat={{chatId}}"]}}"""))
    assertEquals(once, acp("""{"argv":["demo"],"chat":{"args":["{{chatId}}","{{chatId}}"]}}"""))
    assertEquals(once, acp("""{"argv":["demo"],"chat":{"args":["--chat"]}}"""))
    assertEquals("demo: engine.acp.chat.args cannot name {{prompt}}", acp("""{"argv":["demo"],"chat":{"args":["{{chatId}}","{{prompt}}"]}}"""))
    assertEquals("demo: engine.acp.chat.at must be 1..256", acp("""{"argv":["demo"],"chat":{"args":["{{chatId}}"],"at":0}}"""))
    val script = kind(
      """{"engine":{"style":"tui","launch":{"argv":["sh","-c","exec demo \"${'$'}@\"","demo"]},"acp":{"argv":["demo"],"chat":{"args":["{{chatId}}"],"at":4}}}}""",
    )
    assertEquals(listOf("sh", "-c", "exec demo \"\$@\"", "demo", "c1"), script.launch(ctx.copy(chatId = "c1")).argv)
    assertEquals(
      "demo: engine.acp.chat.at must be past the shell script's \$0 (4 or more), or absent",
      refused("""{"engine":{"style":"tui","launch":{"argv":["sh","-c","x","demo"]},"acp":{"argv":["demo"],"chat":{"args":["{{chatId}}"],"at":2}}}}"""),
    )
    assertEquals(
      "demo: an image kind's engine.acp.argv[0] is a guest command or path, without placeholders",
      refused(
        """{"type":"image","requires":{"linux":"required"},"models":null,
           "engine":{"style":"tui","launch":{"argv":["demo"]},"acp":{"argv":["{{home}}/demo"]}}}""",
      ),
    )
  }
}
