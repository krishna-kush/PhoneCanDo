package com.phonecando.agents.kit.cli

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// render-launch on the schema's fixture kinds laid out as agents/ is: Claude
// Code with an ACP mode, an inbox and a state block (its bridge in argv as an
// env reference, plus a `when: bridgeUrl` item added here), and Gemini CLI,
// which needs the node runtime.
class RenderLaunchTest {
  @TempDir lateinit var root: File

  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))

  private fun fixture(name: String) = Json.parseToJsonElement(File(fixtures, "valid/$name.json").readText()).jsonObject

  private fun kind(id: String, manifest: JsonObject): String {
    val dir = File(root, "agents/image/$id").apply { mkdirs() }
    File(dir, "agent.json").writeText(manifest.toString())
    val node = File(root, "agents/runtimes/node/install")
    if (!node.exists()) {
      node.mkdirs()
      File(fixtures, "runtime/valid/node.json").copyTo(File(node.parentFile, "runtime.json"))
      File(node, "glibc.sh").writeText("echo glibc\n")
      File(node, "apk.sh").writeText("echo apk\n")
    }
    return dir.path
  }

  // Claude Code's fixture with a bridge arg that drops out with no bridge.
  private val claude: String get() {
    val m = fixture("claude-code-acp")
    val engine = m.getValue("engine").jsonObject
    val launch = engine.getValue("launch").jsonObject
    val argv = JsonArray(
      launch.getValue("argv").jsonArray + buildJsonObject {
        put("when", JsonPrimitive("bridgeUrl"))
        put("args", JsonArray(listOf(JsonPrimitive("--bridge"), JsonPrimitive("{{bridgeUrl}}/mcp"))))
      },
    )
    val withArg = JsonObject(engine + ("launch" to JsonObject(launch + ("argv" to argv))))
    return kind("claude-code", JsonObject(m + ("engine" to withArg)))
  }

  private fun run(vararg args: String): Triple<Int, String, String> {
    val out = ByteArrayOutputStream()
    val err = ByteArrayOutputStream()
    val code = Cli.main(args.toList(), PrintStream(out, true), PrintStream(err, true)) { null }
    return Triple(code, out.toString(), err.toString())
  }

  private fun json(out: String): JsonObject = Json.parseToJsonElement(out).jsonObject

  private fun JsonObject.strings(name: String) = getValue(name).jsonArray.map { it.jsonPrimitive.content }

  private fun JsonObject.map(name: String) = getValue(name).jsonObject.mapValues { it.value.jsonPrimitive.content }

  @Test fun theTerminalLaunchThroughTheGuestShWithTheRunnersEnv() {
    val (code, out, err) = run("render-launch", "--kind", claude, "--bridge-url", "http://127.0.0.1:9/")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals("terminal", r.getValue("mode").jsonPrimitive.content)
    val argv = r.strings("argv")
    assertEquals(listOf("/bin/sh", "-c", "cd '/root/projects' || exit; exec \"\$0\" \"\$@\""), argv.take(3))
    assertEquals("/root/.local/bin/claude", argv[3])
    assertEquals(listOf("--bridge", "http://127.0.0.1:9/mcp"), argv.takeLast(2), "the bridge arg, with no resume args on a first start")
    assertFalse("--continue" in argv)
    val env = r.map("env")
    assertEquals("xterm-256color", env["TERM"])
    assertEquals("C.UTF-8", env["LANG"])
    assertEquals("/root/.phonecando/bin/phonecando-open", env["BROWSER"])
    assertEquals("1", env["DISABLE_AUTOUPDATER"])
    assertEquals("/root", env["HOME"])
    assertEquals("/tmp", env["TMPDIR"])
    assertEquals("http://127.0.0.1:9", env["PHONECANDO_BRIDGE_URL"])
    assertEquals("/root/.phonecando/events-ci", env["PHONECANDO_EVENTS"])
    assertEquals("/root/.phonecando/inbox-ci", env["PHONECANDO_INBOX"])
    assertEquals("full", env["PHONECANDO_CHANNEL"])
    assertEquals("ci", env["PHONECANDO_AGENT"])
    assertFalse("PHONECANDO_BRIDGE_TOKEN" in env, "the token is the caller's to set")
    assertEquals("PHONECANDO_BRIDGE_TOKEN", r.getValue("token").jsonPrimitive.content)
    assertEquals("/root/.phonecando/claude-code", r.getValue("configDir").jsonPrimitive.content)
    assertEquals("/root/.phonecando/bin", r.getValue("kitBin").jsonPrimitive.content)
  }

  @Test fun theAcpLaunchKeepsASessionBridgeOutOfItsEnv() {
    val (code, out, err) = run("render-launch", "--kind", claude, "--mode", "acp", "--bridge-url", "http://127.0.0.1:9")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals(listOf("/bin/sh", "-c", "cd '/root/projects' || exit; exec \"\$0\" \"\$@\"", "/root/.local/bin/claude-agent-acp"), r.strings("argv"))
    val env = r.map("env")
    assertEquals("/tmp/acp.log", env["CLAUDE_AGENT_ACP_LOG"], "the ACP env, rendered guest side")
    assertFalse("TERM" in env, "no terminal in ACP mode")
    assertFalse("PHONECANDO_BRIDGE_URL" in env, "tools \"session\": the bridge goes in session/new")
    assertEquals(JsonNull, r.getValue("token"))
    assertEquals("/root/.phonecando/events-ci", env["PHONECANDO_EVENTS"])
  }

  @Test fun noBridgeDropsItsArgsAndValues() {
    val (code, out, err) = run("render-launch", "--kind", claude)
    assertEquals(0, code, err)
    val r = json(out)
    assertFalse("--bridge" in r.strings("argv"))
    assertFalse("PHONECANDO_BRIDGE_URL" in r.map("env"))
    assertEquals(JsonNull, r.getValue("token"))
  }

  @Test fun anAgentWithItsOwnStateFolder() {
    val (code, out, err) = run("render-launch", "--kind", claude, "--agent", "a2", "--state")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals("/root/.phonecando/agents/a2/claude", r.map("env")["CLAUDE_CONFIG_DIR"])
    assertEquals("a2", r.map("env")["PHONECANDO_AGENT"])
    assertEquals("/root/.phonecando/inbox-a2", r.map("env")["PHONECANDO_INBOX"])
    assertEquals("/root/.phonecando/claude-code", r.getValue("configDir").jsonPrimitive.content, "its config stays put: no state.config")
  }

  @Test fun theKindsRuntimesComeFirstOnPath() {
    val (code, out, err) = run("render-launch", "--kind", kind("gemini-cli", fixture("gemini-cli")), "--bridge-url", "http://127.0.0.1:9")
    assertEquals(0, code, err)
    val r = json(out)
    assertEquals(
      "cd '/root/projects' || exit; PATH='/root/.local/opt/node/bin':\$PATH; export PATH; exec \"\$0\" \"\$@\"",
      r.strings("argv")[2],
    )
    assertEquals("gemini", r.strings("argv")[3])
    assertFalse("PHONECANDO_INBOX" in r.map("env"), "no inbox block")
    assertEquals("/root/.phonecando/gemini", r.getValue("configDir").jsonPrimitive.content)
  }

  @Test fun refusesWhatItCannotRender() {
    val gemini = kind("gemini-cli", fixture("gemini-cli"))
    val noAcp = run("render-launch", "--kind", gemini, "--mode", "acp")
    assertEquals(1 to "", noAcp.first to noAcp.second)
    assertTrue("gemini-cli has no ACP mode" in noAcp.third, noAcp.third)
    val badMode = run("render-launch", "--kind", gemini, "--mode", "server")
    assertEquals(2, badMode.first)
    val badUrl = run("render-launch", "--kind", gemini, "--bridge-url", "127.0.0.1:9")
    assertEquals(2, badUrl.first)
  }
}
