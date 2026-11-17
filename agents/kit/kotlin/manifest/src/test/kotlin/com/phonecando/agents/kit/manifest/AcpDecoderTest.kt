package com.phonecando.agents.kit.manifest

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

// JVM checks for a tui engine's ACP mode (AcpDecoder): every part read with
// its types and defaults, and what it refuses at its JSON pointer.
class AcpDecoderTest {
  private fun manifest(acp: String, origin: Origin = Origin.BUNDLED) = ManifestDecoder.decode(
    """{"schema":1,"id":"user.demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview",
       "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["demo"]},"acp":$acp},"surfaces":{"home":"tui"}}""",
    origin,
  )

  private fun decode(acp: String) = manifest(acp).engine!!.acp!!

  private fun problem(acp: String, origin: Origin = Origin.BUNDLED): String =
    assertFailsWith<ManifestException> { manifest(acp, origin) }.message!!

  @Test fun readsEveryPart() {
    val acp = decode(
      """{"argv":["demo",{"when":"bridgeUrl","args":["--mcp","{{bridgeUrl}}"]},"--acp"],
          "env":{"Z":"1","A":"{{home}}"},"tools":"config","options":{"mode":"default","model":"m"},"optionsHook":"demo.pick",
          "meta":{"x":{"settings":"{{home}}/s.json","n":2}},"chat":{"args":["--resume","{{chatId}}"],"at":1}}""",
    )
    assertEquals(
      listOf(ArgvItem.Text("demo"), ArgvItem.When("bridgeUrl", listOf("--mcp", "{{bridgeUrl}}")), ArgvItem.Text("--acp")),
      acp.argv,
    )
    // Env and options in manifest order.
    assertEquals(listOf("Z" to "1", "A" to "{{home}}"), acp.env.toList())
    assertEquals(AcpTools.CONFIG, acp.tools)
    assertEquals(listOf("mode" to "default", "model" to "m"), acp.options.toList())
    assertEquals("demo.pick", acp.optionsHook)
    // Meta stays a JSON tree, its templates unrendered.
    assertEquals(JsonPrimitive("{{home}}/s.json"), acp.meta!!["x"]!!.jsonObject["settings"])
    assertEquals(ChatArgs(listOf("--resume", "{{chatId}}"), 1), acp.chat)
  }

  @Test fun onlyTheArgvIsRequired() {
    val acp = decode("""{"argv":["demo","--acp"]}""")
    assertEquals(AcpSpec(listOf(ArgvItem.Text("demo"), ArgvItem.Text("--acp")), emptyMap()), acp)
    assertEquals(AcpTools.SESSION, acp.tools)
    assertNull(acp.meta)
    assertNull(acp.optionsHook)
    assertNull(acp.chat)
    // No block: no ACP mode.
    val plain = """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview",
       "engine":{"style":"tui","launch":{"argv":["demo"]}}}"""
    assertNull(ManifestDecoder.decode(plain).engine!!.acp)
  }

  @Test fun errorsNameTheJsonPointer() {
    assertEquals("/engine/acp/argv: is required", problem("{}"))
    assertEquals("/engine/acp/argv/1: must be a string, not 2", problem("""{"argv":["demo",2]}"""))
    assertEquals("/engine/acp/env/A: must be a string, not 1", problem("""{"argv":["demo"],"env":{"A":1}}"""))
    assertEquals("/engine/acp/tools: must be one of session, config, not argv", problem("""{"argv":["demo"],"tools":"argv"}"""))
    assertEquals("/engine/acp/options/mode: must be a string, not true", problem("""{"argv":["demo"],"options":{"mode":true}}"""))
    assertEquals("/engine/acp/optionsHook: must be a string, not 1", problem("""{"argv":["demo"],"optionsHook":1}"""))
    assertEquals("/engine/acp/meta: must be an object, not an array", problem("""{"argv":["demo"],"meta":[]}"""))
    assertEquals("/engine/acp/chat/args: is required", problem("""{"argv":["demo"],"chat":{}}"""))
    assertEquals("/engine/acp/chat/at: must be an integer", problem("""{"argv":["demo"],"chat":{"args":["{{chatId}}"],"at":"1"}}"""))
    assertEquals("/engine/acp: must be an object, not a string", problem("\"demo --acp\""))
  }

  @Test fun aUserKindSetsNoHostEnvHere() {
    assertEquals(listOf("TOP" to "1"), manifest("""{"argv":["demo"],"env":{"TOP":"1"}}""", Origin.USER).engine!!.acp!!.env.toList())
    assertEquals("/engine/acp/env/PATH: PATH is the host's to set", problem("""{"argv":["demo"],"env":{"PATH":"/x"}}""", Origin.USER))
    assertEquals(
      "/engine/acp/env/PHONECANDO_BRIDGE_TOKEN: PHONECANDO_BRIDGE_TOKEN is the host's to set",
      problem("""{"argv":["demo"],"env":{"PHONECANDO_BRIDGE_TOKEN":"x"}}""", Origin.USER),
    )
  }
}
