package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// JVM checks for ManifestDecoder: every runtime block read with its types,
// unread fields ignored, and errors that name the JSON pointer.
class ManifestDecoderTest {
  private val full = """
    {
      "schema": 1, "id": "demo", "label": "Demo", "version": "1.2.3", "type": "native", "prefix": "dm",
      "channels": ["full", "lite"], "stability": "preview",
      "licence": { "spdx": "MIT", "redistributed": true, "notice": "NOTICE.md", "source": "https://x" },
      "payload": { "libs": [] },
      "config": { "dir": "config", "into": ".config/demo", "keep": ["demo.json"] },
      "instructions": ".config/demo/AGENTS.md",
      "userState": [".config/demo", ".local/share/demo"],
      "state": { "env": { "DEMO_HOME": "{{stateDir}}/demo", "DEMO_CONFIG": "{{stateDir}}/config" }, "instructions": "config/AGENTS.md", "config": "config" },
      "engine": {
        "style": "server",
        "launch": {
          "argv": ["{{libDir}}/libdm-engine.so", { "when": "sessionId", "args": ["-s", "{{sessionId}}"] }],
          "env": { "Z_FIRST": "1", "A_SECOND": "{{password}}", "M_THIRD": "${'$'}{HOME}" }
        },
        "auth": { "basic": { "user": "demo" } },
        "readiness": { "http": { "path": "/health" } }
      },
      "events": [{ "sse": { "path": "/events", "parser": "demo.events" } }],
      "chats": { "title": { "http": { "path": "/chat/{{sessionId}}", "json": "/title" } } },
      "idle": { "from": ["events"], "quietSec": 30 },
      "surfaces": {
        "home": "web",
        "web": {
          "pair": { "method": "POST", "path": "/pair", "code": ["/code"], "url": "/in/{{code}}" },
          "adapter": { "cssVars": { "--b": "bg", "--a": "fg" }, "authUrl": "/in/", "extra": { "x": [1] } }
        },
        "terminal": { "client": { "argv": ["tui"], "env": {}, "cwd": "{{projectDir}}" }, "chatTitle": "^T (.+)$" }
      },
      "signIn": [{ "method": "in-ui", "note": "Sign in." }],
      "hooks": ["demo.events"]
    }
  """.trimIndent()

  @Test fun readsEveryRuntimeBlock() {
    val m = ManifestDecoder.decode(full)
    assertEquals("demo", m.id)
    assertEquals(listOf("full", "lite"), m.channels)
    assertEquals(Config(".config/demo", listOf("demo.json")), m.config)
    assertEquals(".config/demo/AGENTS.md", m.instructions)
    assertEquals(listOf(".config/demo", ".local/share/demo"), m.userState)
    // The state env in manifest order.
    val state = m.state!!
    assertEquals(listOf("DEMO_HOME" to "{{stateDir}}/demo", "DEMO_CONFIG" to "{{stateDir}}/config"), state.env.toList())
    assertEquals(StateFolder(state.env, "config/AGENTS.md", "config"), state)
    val engine = m.engine!!
    assertEquals(EngineStyle.SERVER, engine.style)
    assertEquals(
      listOf(ArgvItem.Text("{{libDir}}/libdm-engine.so"), ArgvItem.When("sessionId", listOf("-s", "{{sessionId}}"))),
      engine.launch!!.argv,
    )
    // Manifest order, and ${…} left alone.
    assertEquals(listOf("Z_FIRST" to "1", "A_SECOND" to "{{password}}", "M_THIRD" to "\${HOME}"), engine.launch!!.env.toList())
    assertNull(engine.launch!!.cwd)
    assertEquals("demo", engine.auth!!.basic!!.user)
    assertEquals("/health", engine.readiness!!.http!!.path)
    assertEquals(listOf(EventSource.Sse("/events", "demo.events")), m.events)
    assertEquals(TitleSource("/chat/{{sessionId}}", "/title"), m.chats!!.title)
    assertEquals(Idle(listOf("events"), 30), m.idle)
    val surfaces = m.surfaces!!
    assertEquals(HomeSurface.WEB, surfaces.home)
    assertEquals(WebPair("POST", "/pair", listOf("/code"), "/in/{{code}}"), surfaces.web!!.pair)
    // Verbatim, in manifest order, fields this build does not read included.
    assertEquals("""{"cssVars":{"--b":"bg","--a":"fg"},"authUrl":"/in/","extra":{"x":[1]}}""", surfaces.web!!.adapter.toString())
    assertEquals("{{projectDir}}", surfaces.terminal!!.client!!.cwd)
    assertEquals("^T (.+)$", surfaces.terminal!!.chatTitle)
    assertEquals(JsonPrimitive("in-ui"), m.signIn.single().jsonObject["method"])
    assertEquals(listOf("demo.events"), m.hooks)
  }

  @Test fun optionalBlocksMayBeAbsent() {
    val m = ManifestDecoder.decode(
      """{"schema":1,"id":"user.htop","label":"htop","version":"1","type":"image","channels":["full"],"stability":"preview"}""",
    )
    assertNull(m.config)
    assertNull(m.instructions)
    assertNull(m.state)
    assertTrue(m.userState.isEmpty())
    assertNull(m.engine)
    assertNull(m.surfaces)
    assertTrue(m.events.isEmpty())
    assertTrue(m.signIn.isEmpty())
    assertTrue(m.hooks.isEmpty())
  }

  @Test fun readsTheTuiBlocks() {
    val m = ManifestDecoder.decode(
      """
      {
        "schema": 1, "id": "tuido", "label": "Tuido", "version": "1", "type": "image", "channels": ["full"], "stability": "preview",
        "requires": { "linux": "required", "commands": ["tuido"] },
        "install": { "families": ["apt"] },
        "engine": {
          "style": "tui",
          "launch": { "argv": ["tuido"], "env": {}, "cwd": "{{projectDir}}" },
          "readiness": { "output": { "settleMs": 250 } },
          "resume": { "args": ["--continue"], "at": 1 }
        },
        "events": [{ "pty": { "rules": [
          { "on": "bel", "event": "waiting" },
          { "on": "osc9", "match": "^Approval requested", "event": "waiting" },
          { "on": "osc777", "event": "finished" },
          { "on": "progress", "match": "^2", "event": "failed" },
          { "on": "osc7501", "match": "^state=blocked", "event": "waiting" }
        ] } }],
        "idle": { "from": ["output"], "quietSec": 120 },
        "surfaces": { "home": "tui", "terminal": { "shell": true }, "chatTitle": "^(.+)$" }
      }
      """.trimIndent(),
    )
    assertEquals(Origin.BUNDLED, m.origin)
    assertEquals(LinuxNeed.REQUIRED, m.linux)
    assertEquals(listOf("apt"), m.install!!.families)
    assertTrue(m.payloadLibs.isEmpty())
    val engine = m.engine!!
    assertEquals(EngineStyle.TUI, engine.style)
    assertEquals("{{projectDir}}", engine.launch!!.cwd)
    assertEquals(Readiness(null, OutputReadiness(250, null), null), engine.readiness)
    assertEquals(Resume(listOf("--continue"), 1), engine.resume)
    assertEquals(
      listOf(
        PtyRule(PtySignal.BEL, null, PtyEvent.WAITING),
        PtyRule(PtySignal.OSC9, "^Approval requested", PtyEvent.WAITING),
        PtyRule(PtySignal.OSC777, null, PtyEvent.FINISHED),
        PtyRule(PtySignal.PROGRESS, "^2", PtyEvent.FAILED),
        PtyRule(PtySignal.OSC7501, "^state=blocked", PtyEvent.WAITING),
      ),
      (m.events.single() as EventSource.Pty).rules,
    )
    assertEquals(Idle(listOf("output"), 120), m.idle)
    assertEquals("^(.+)$", m.surfaces!!.chatTitle)
    assertNull(m.surfaces!!.terminal!!.client)
  }

  @Test fun readsWhatThePickerNeeds() {
    val native = ManifestDecoder.decode(full)
    assertEquals(emptyList(), native.payloadLibs)
    assertNull(native.linux)
    assertNull(native.install)
    val libs = ManifestDecoder.decode(with("\"payload\":{\"libs\":[{\"name\":\"libdm-engine.so\",\"from\":\"x\"}]}"))
    assertEquals(listOf("libdm-engine.so"), libs.payloadLibs)
    assertEquals(Readiness(null, null, AliveReadiness(null)), ManifestDecoder.decode(with("\"engine\":{\"style\":\"tui\",\"readiness\":{\"alive\":{}}}")).engine!!.readiness)
  }

  // A user's manifest that keeps every user rule.
  private val user = """
    {"schema":1,"id":"user.top","label":"top","version":"1","type":"image","channels":["full","lite"],"stability":"preview",
     "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["top"]}},"surfaces":{"home":"tui"}}
  """.trimIndent()

  private fun userProblem(patch: (String) -> String): String =
    assertFailsWith<ManifestException> { ManifestDecoder.decode(patch(user), Origin.USER) }.message!!

  @Test fun userRules() {
    assertEquals(Origin.USER, ManifestDecoder.decode(user, Origin.USER).origin)
    assertEquals("/id: a user kind's id starts with user.", userProblem { it.replace("user.top", "top") })
    assertEquals("/type: a user kind is an image kind", userProblem { it.replace("\"image\"", "\"native\"") })
    assertEquals("/engine/style: a user kind's engine is its TUI (tui)", userProblem { it.replace("\"tui\",\"launch\"", "\"server\",\"launch\"") })
    assertEquals("/engine: is required", userProblem { it.replace(",\"engine\":{\"style\":\"tui\",\"launch\":{\"argv\":[\"top\"]}}", "") })
    assertEquals("/requires/linux: a user kind needs Linux (required)", userProblem { it.replace("\"required\"", "\"optional\"") })
    assertEquals("/hooks: a user kind has none", userProblem { it.replace("\"stability\"", "\"hooks\":[],\"stability\"") })
    assertEquals("/payload: a user kind has none", userProblem { it.replace("\"stability\"", "\"payload\":{\"libs\":[]},\"stability\"") })
    assertEquals("/default: a user kind is never the default", userProblem { it.replace("\"stability\"", "\"default\":true,\"stability\"") })
    assertEquals(
      "/config/overlay: a user kind packages no config",
      userProblem { it.replace("\"stability\"", "\"config\":{\"into\":\".top\",\"overlay\":\"x\"},\"stability\"") },
    )
    assertEquals("/surfaces/web: a user kind has no web surface", userProblem { it.replace("{\"home\":\"tui\"}", "{\"home\":\"tui\",\"web\":{}}") })
    assertEquals("/surfaces/home: a user kind's Home is its TUI (tui)", userProblem { it.replace("{\"home\":\"tui\"}", "{\"home\":\"web\"}") })
    assertEquals(
      "/engine/launch/env/PATH: PATH is the host's to set",
      userProblem { it.replace("[\"top\"]}", "[\"top\"],\"env\":{\"TERM\":\"x\",\"PATH\":\"/x\"}}") },
    )
    assertEquals(
      "/engine/launch/env/LD_PRELOAD: LD_PRELOAD is the host's to set",
      userProblem { it.replace("[\"top\"]}", "[\"top\"],\"env\":{\"LD_PRELOAD\":\"/x.so\"}}") },
    )
    assertEquals(
      "/state/env/HOME: HOME is the host's to set",
      userProblem { it.replace("\"stability\"", "\"state\":{\"env\":{\"TOP_DIR\":\"{{stateDir}}\",\"HOME\":\"{{stateDir}}\"}},\"stability\"") },
    )
    // A bundled kind is not held to them.
    assertEquals("top", ManifestDecoder.decode(user.replace("user.top", "top")).id)
  }

  @Test fun userScriptsAreCapped() {
    val step = "x".repeat(1023)
    fun steps(n: Int) = (1..n).joinToString(",") { "\"$step\"" }
    // 32 steps of 1023 bytes, joined by newlines: one byte under 32 KiB.
    val install = ",\"install\":{\"steps\":[${steps(32)}]},\"versionCheck\":{\"argv\":[\"top\"],\"pattern\":\"(.+)\"}}"
    val atCap = user.removeSuffix("}") + install
    assertEquals(32, ManifestDecoder.decode(atCap, Origin.USER).install!!.steps.size)
    assertEquals(
      "/install/steps: a user kind's install steps are at most 32 KiB",
      userProblem { atCap.replace("[${steps(32)}]", "[${steps(32)},\"x\"]") },
    )
    assertEquals(
      "/update/steps: a user kind's update steps are at most 32 KiB",
      userProblem { atCap.replace(",\"versionCheck\"", ",\"update\":{\"steps\":[${steps(33)}]},\"versionCheck\"") },
    )
  }

  @Test fun readsPhoneTools() {
    assertNull(ManifestDecoder.decode(user).phoneTools)
    assertEquals(PhoneTools.NONE, ManifestDecoder.decode(with("\"phoneTools\":\"none\"")).phoneTools)
    assertEquals(PhoneTools.MCP_ARGV, ManifestDecoder.decode(with("\"phoneTools\":\"mcp:argv\"")).phoneTools)
    assertEquals(
      "/phoneTools: must be one of plugin, mcp:config, mcp:argv, none, not bluetooth",
      problem(with("\"phoneTools\":\"bluetooth\"")),
    )
  }

  @Test fun readsTheDefaultFlag() {
    assertFalse(ManifestDecoder.decode(user).isDefault)
    assertTrue(ManifestDecoder.decode(with("\"default\":true")).isDefault)
    assertFalse(ManifestDecoder.decode(with("\"default\":false")).isDefault)
    assertEquals("/default: must be true or false", problem(with("\"default\":\"yes\"")))
    assertEquals("/default: must be true or false", problem(with("\"default\":1")))
  }

  private fun problem(json: String): String = assertFailsWith<ManifestException> { ManifestDecoder.decode(json) }.message!!

  private fun with(field: String) =
    """{"schema":1,"id":"d","label":"D","version":"1","type":"image","channels":["full"],"stability":"stable",$field}"""

  @Test fun errorsNameTheJsonPointer() {
    assertTrue(problem("{nope").startsWith("/: not JSON"))
    assertEquals("/: must be an object, not an array", problem("[]"))
    assertEquals("/schema: must be 1", problem(with("\"x\":0").replace("\"schema\":1", "\"schema\":2")))
    assertEquals("/label: must be a string, not null", problem(with("\"x\":0").replace("\"D\"", "null")))
    assertEquals("/channels/0: must be a string, not 3", problem(with("\"x\":0").replace("[\"full\"]", "[3]")))
    assertEquals(
      "/engine/style: must be one of server, tui, not acp",
      problem(with("\"engine\":{\"style\":\"acp\"}")),
    )
    assertEquals(
      "/engine/launch/argv/1: must be a string, not an array",
      problem(with("\"engine\":{\"style\":\"server\",\"launch\":{\"argv\":[\"a\",[]]}}")),
    )
    assertEquals(
      "/engine/launch/argv/0/args: is required",
      problem(with("\"engine\":{\"style\":\"server\",\"launch\":{\"argv\":[{\"when\":\"sessionId\"}]}}")),
    )
    assertEquals(
      "/engine/launch/env/A: must be a string, not 1",
      problem(with("\"engine\":{\"style\":\"server\",\"launch\":{\"argv\":[],\"env\":{\"A\":1}}}")),
    )
    assertEquals("/idle/quietSec: must be an integer", problem(with("\"idle\":{\"from\":[],\"quietSec\":\"60\"}")))
    assertEquals("/events/0: is no event source this build reads (sse, pty, hook)", problem(with("\"events\":[{\"acp\":{}}]")))
    assertEquals("/events/0/pty/rules: is required", problem(with("\"events\":[{\"pty\":{}}]")))
    assertEquals(
      "/events/0/pty/rules/0/on: must be one of bel, osc9, osc777, progress, osc7501, not osc52",
      problem(with("\"events\":[{\"pty\":{\"rules\":[{\"on\":\"osc52\",\"event\":\"waiting\"}]}}]")),
    )
    assertEquals("/requires/linux: must be one of required, optional, none, not yes", problem(with("\"requires\":{\"linux\":\"yes\"}")))
    assertEquals("/install: must be an object, not 3", problem(with("\"install\":3")))
    assertEquals("/engine/readiness/alive/ms: must be an integer", problem(with("\"engine\":{\"style\":\"tui\",\"readiness\":{\"alive\":{\"ms\":\"1\"}}}")))
    assertEquals("/surfaces/home: is required", problem(with("\"surfaces\":{}")))
    assertEquals("/instructions: must be a string, not an object", problem(with("\"instructions\":{}")))
    assertEquals("/userState/0: must be a string, not 1", problem(with("\"userState\":[1]")))
    assertEquals("/state/env: is required", problem(with("\"state\":{\"instructions\":\"a.md\"}")))
    assertEquals("/state/env/A: must be a string, not 1", problem(with("\"state\":{\"env\":{\"A\":1}}")))
    assertEquals("/state/config: must be a string, not true", problem(with("\"state\":{\"env\":{},\"config\":true}")))
    assertEquals("/chats/title/http: is required", problem(with("\"chats\":{\"title\":{}}")))
    assertEquals("/idle/from/0: must be one of events, output, not pty", problem(with("\"idle\":{\"from\":[\"pty\"],\"quietSec\":60}")))
    val web = "\"surfaces\":{\"home\":\"web\",\"web\":"
    assertEquals(
      "/surfaces/web/pair/method: must be one of POST, not GET",
      problem(with("$web{\"pair\":{\"method\":\"GET\",\"path\":\"/p\",\"code\":[],\"url\":\"/u\"}}}")),
    )
    assertEquals("/surfaces/web/adapter/authUrl: is required", problem(with("$web{\"adapter\":{\"cssVars\":{}}}}")))
    assertEquals("/surfaces/web/adapter/cssVars: is required", problem(with("$web{\"adapter\":{\"authUrl\":\"/a\"}}}")))
    assertEquals(
      "/surfaces/web/adapter/hide/0: must be a string, not 1",
      problem(with("$web{\"adapter\":{\"cssVars\":{},\"authUrl\":\"/a\",\"hide\":[1]}}}")),
    )
    // A key with / or ~ is escaped in the pointer.
    assertEquals(
      "/engine/launch/env/A~1B~0: must be a string, not true",
      problem(with("\"engine\":{\"style\":\"server\",\"launch\":{\"argv\":[],\"env\":{\"A/B~\":true}}}")),
    )
  }
}
