package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.Capability.ACP
import com.phonecando.agents.kit.Capability.ACP_MESSAGES
import com.phonecando.agents.kit.Capability.ACP_TOOLS
import com.phonecando.agents.kit.Capability.CHAT
import com.phonecando.agents.kit.Capability.MESSAGES
import com.phonecando.agents.kit.Capability.STATE
import com.phonecando.agents.kit.Capability.TASK
import com.phonecando.agents.kit.Capability.TOOLS
import com.phonecando.agents.kit.Capability.WAKE
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.Origin
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// KindCapabilities on the schema's fixtures and on made-up kinds: what each
// manifest declares, and the setting key: the same however the manifest's
// keys are ordered, new when a part its capability rests on changes, and
// only then.
class KindCapabilitiesTest {
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))

  // opencode's manifest names its SSE parser and its reply parser.
  private val opencodeHooks = object : KindHooks {
    override val id = "opencode"

    override fun sseParser(name: String): ((String) -> EngineEvent?)? = { null }

    override fun replyParser(name: String): ((String) -> String?)? = { null }
  }

  private fun text(file: String) = File(fixtures, "valid/$file").readText()

  private fun kind(text: String, origin: Origin = Origin.BUNDLED, hooks: KindHooks? = null) =
    ManifestKind.of(ManifestDecoder.decode(text, origin), hooks, Runtimes.catalog(fixtures))

  private fun fixture(file: String) = kind(
    text(file),
    if (file.startsWith("user-")) Origin.USER else Origin.BUNDLED,
    opencodeHooks.takeIf { file == "opencode.json" },
  )

  // A native TUI kind with nothing but [engine] (more members of its engine) and [fields].
  private fun demo(engine: String = "", fields: String = "") = kind(
    """{"schema":1,"id":"demo","label":"Demo","version":"3","type":"native","channels":["full"],"stability":"preview",
       "engine":{"style":"tui","launch":{"argv":["demo"]}$engine}$fields}""",
  )

  private fun declared(kind: ManifestKind) = KindCapabilities.declared(kind).toList()

  private fun declared(file: String) = declared(fixture(file))

  // [json] with [value] at the dotted [path], made where absent.
  private fun set(json: JsonObject, path: String, value: JsonElement): JsonObject {
    val key = path.substringBefore('.')
    val inner = if ('.' in path) set(json[key]?.jsonObject ?: JsonObject(emptyMap()), path.substringAfter('.'), value) else value
    return JsonObject(json + (key to inner))
  }

  // [json] with every object's keys in reverse order.
  private fun reversed(json: JsonElement): JsonElement = when (json) {
    is JsonObject -> JsonObject(json.keys.reversed().associateWith { reversed(json.getValue(it)) })
    is JsonArray -> JsonArray(json.map(::reversed))
    else -> json
  }

  @Test fun capabilitiesByWireName() {
    assertEquals(
      listOf("tools", "messages", "wake", "task", "state", "acp", "acpTools", "acpMessages", "chat"),
      Capability.entries.map { it.wire },
    )
    for (c in Capability.entries) assertEquals(c, Capability.of(c.wire))
    assertNull(Capability.of("TOOLS"))
    assertNull(Capability.of(""))
  }

  @Test fun declaredFromTheFixtures() {
    assertEquals(listOf(TOOLS, MESSAGES, WAKE, STATE, ACP, ACP_TOOLS, ACP_MESSAGES, CHAT), declared("claude-code-acp.json"))
    assertEquals(listOf(TOOLS, MESSAGES, WAKE, STATE), declared("claude-code.json"))
    // An inbox its own extension reads.
    assertEquals(listOf(TOOLS, MESSAGES, STATE), declared("codex.json"))
    // A server inbox.
    assertEquals(listOf(TOOLS, MESSAGES, WAKE, STATE), declared("opencode.json"))
    // ACP mode with no phone tools, no inbox and no chat args.
    assertEquals(listOf(ACP), declared("user-top-acp.json"))
    assertEquals(emptyList(), declared("user-htop.json"))
  }

  @Test fun eachRuleReadsItsOwnPart() {
    val acp = ""","acp":{"argv":["demo","acp"]}"""
    val hooks = ""","inbox":{"hooks":{"Stop":{"format":"text","template":"{{messages}}"}}}"""
    assertEquals(emptyList(), declared(demo()))
    assertEquals(listOf(TASK), declared(demo(engine = ""","prompt":{"args":["{{prompt}}"]}""")))
    // "none" gets no bridge.
    assertEquals(emptyList(), declared(demo(fields = ""","phoneTools":"none"""")))
    // In ACP mode: phone tools need phone tools, messages need inbox hooks.
    assertEquals(
      listOf(TOOLS, MESSAGES, ACP, ACP_TOOLS),
      declared(demo(engine = acp, fields = ""","phoneTools":"mcp:argv","phoneToolsTrust":{"in":"argv","has":"demo"},"inbox":{"reader":true}""")),
    )
    assertEquals(listOf(MESSAGES, ACP, ACP_MESSAGES), declared(demo(engine = acp, fields = hooks)))
  }

  @Test fun keyIsTheVersionThenSixteenHex() {
    // No state block: the setting is {"state":null}.
    assertEquals("1:aca66b739fcde148", KindCapabilities.key(fixture("user-htop.json"), STATE))
    val claude = fixture("claude-code-acp.json")
    for (c in Capability.entries) {
      val key = KindCapabilities.key(claude, c)
      assertTrue(Regex("0\\.0\\.0-fixture:[0-9a-f]{16}").matches(key), key)
    }
  }

  @Test fun canonicalJsonSortsEveryLevelWithNoWhitespace() {
    val json = Json.parseToJsonElement("""{ "b": [ {"d": 1, "c": "x\"y"}, 2 ], "a": null, "B": true }""")
    assertEquals("""{"B":true,"a":null,"b":[{"c":"x\"y","d":1},2]}""", CanonicalJson.of(json))
  }

  @Test fun keyIsTheSameHoweverTheKeysAreOrdered() {
    val text = text("claude-code-acp.json")
    val shuffled = reversed(Json.parseToJsonElement(text)).toString()
    assertNotEquals(Json.parseToJsonElement(text).toString(), shuffled)
    val a = kind(text)
    val b = kind(shuffled)
    for (c in Capability.entries) assertEquals(KindCapabilities.key(a, c), KindCapabilities.key(b, c), c.wire)
  }

  @Test fun keyChangesWithItsPartsOnly() {
    val base = Json.parseToJsonElement(text("claude-code-acp.json")).jsonObject
    val before = kind(base.toString()).let { k -> Capability.entries.associateWith { KindCapabilities.key(k, it) } }
    fun changed(path: String, value: JsonElement): Set<Capability> {
      val after = kind(set(base, path, value).toString())
      return Capability.entries.filterTo(LinkedHashSet()) { KindCapabilities.key(after, it) != before[it] }
    }
    assertEquals(setOf(MESSAGES, WAKE, ACP_MESSAGES), changed("inbox.hooks.Stop.exit", JsonPrimitive(1)))
    assertEquals(setOf(ACP, ACP_TOOLS, ACP_MESSAGES, CHAT), changed("engine.acp.chat.at", JsonPrimitive(2)))
    assertEquals(setOf(ACP, ACP_TOOLS, ACP_MESSAGES), changed("engine.acp.options.mode", JsonPrimitive("auto")))
    assertEquals(setOf(TOOLS, TASK, CHAT), changed("engine.launch.cwd", JsonPrimitive("{{home}}")))
    assertEquals(setOf(TASK), changed("engine.prompt", Json.parseToJsonElement("""{"args":["{{prompt}}"]}""")))
    assertEquals(setOf(TOOLS, ACP_TOOLS), changed("phoneTools", JsonPrimitive("mcp:config")))
    assertEquals(setOf(TOOLS, ACP_TOOLS), changed("phoneToolsTrust.has", JsonPrimitive("mcp__phonecando__")))
    assertEquals(setOf(STATE), changed("state.env.CLAUDE_CONFIG_DIR", JsonPrimitive("{{stateDir}}/c")))
    assertEquals(
      setOf(TOOLS, MESSAGES, WAKE, ACP_TOOLS, ACP_MESSAGES),
      changed("config", Json.parseToJsonElement("""{"dir":"config","into":".phonecando/claude"}""")),
    )
    // Parts no capability rests on.
    assertEquals(emptySet(), changed("label", JsonPrimitive("Claude")))
    assertEquals(emptySet(), changed("engine.resume.at", JsonPrimitive(2)))
    // The version leads every key.
    assertEquals(Capability.entries.toSet(), changed("version", JsonPrimitive("0.0.1")))
  }
}
