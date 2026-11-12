package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
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

// An agent with a state folder of its own (the manifest's `state`): the
// state env in its launch, {{stateDir}} as a native and as an image kind's
// program sees it, where its instructions file and config go, what of()
// refuses, and KindView's stateFolder.
class StateFolderTest {
  // A native TUI kind whose config folder holds its instructions file and its state.
  private val base = """
    {
      "schema": 1, "id": "demo", "label": "Demo", "version": "1", "type": "native",
      "channels": ["full"], "stability": "preview",
      "config": { "into": ".config/demo", "keep": ["demo.json"] },
      "instructions": ".config/demo/AGENTS.md",
      "state": { "env": { "DEMO_CONFIG_DIR": "{{stateDir}}/config", "DEMO_DATA": "{{stateDir}}/data" },
                 "instructions": "config/AGENTS.md", "config": "config" },
      "engine": { "style": "tui", "launch": { "argv": ["demo"], "env": { "DEMO_DATA": "{{home}}/.demo", "KEEP": "1" } } },
      "models": { "openai-chat": { "env": { "DEMO_MODEL": "{{model}}" } } }
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

  private val image = """{"type":"image","requires":{"linux":"required"}}"""
  private val home = File("/i/home")
  private val own = File("/i/home/.phonecando/agents/a2")
  private val ctx = LaunchContext("/lib", home, File("/i/tmp"), "", "pw", image = File("/i"))

  @Test fun theKindsDefaultsWithoutAStateFolder() {
    val k = kind()
    assertEquals(listOf("DEMO_DATA" to "/i/home/.demo", "KEEP" to "1"), k.launch(ctx).env.toList())
    assertEquals(File("/i/home/.config/demo/AGENTS.md"), k.instructionsFile(home, null))
    assertEquals(File("/i/home/.config/demo"), k.configDir(home, null))
  }

  @Test fun aNativeKindSeesTheHostPath() {
    val spec = kind().launch(ctx.copy(stateDir = own))
    // After the kind's own env, so the agent's value wins a name in both.
    assertEquals(
      listOf("DEMO_DATA" to "/i/home/.phonecando/agents/a2/data", "KEEP" to "1", "DEMO_CONFIG_DIR" to "/i/home/.phonecando/agents/a2/config"),
      spec.env.toList(),
    )
  }

  @Test fun anImageKindSeesTheGuestPath() {
    val spec = kind(image).launch(ctx.copy(stateDir = own))
    assertEquals(
      listOf(
        "DEMO_DATA" to "/root/.phonecando/agents/a2/data",
        "KEEP" to "1",
        "DEMO_CONFIG_DIR" to "/root/.phonecando/agents/a2/config",
        "HOME" to "/root",
        "TMPDIR" to "/tmp",
      ),
      spec.env.toList(),
    )
    // Only a folder in the image home is in the guest.
    val outside = assertFailsWith<KindException> { kind(image).launch(ctx.copy(stateDir = File("/i/home/../state"))) }
    assertEquals("the state folder /i/home/../state is not in the image home /i/home", outside.message)
    assertFailsWith<KindException> { kind(image).launch(ctx.copy(stateDir = File("/elsewhere/a2"))) }
  }

  @Test fun theModelComesAfterTheState() {
    val model = ModelEndpoint("http://127.0.0.1:9", "m", "k", 4096, listOf("openai-chat"))
    val spec = kind().launch(ctx.copy(stateDir = own, model = model))
    assertEquals(listOf("DEMO_DATA", "KEEP", "DEMO_CONFIG_DIR", "DEMO_MODEL"), spec.env.keys.toList())
  }

  @Test fun instructionsAndConfigMoveWithTheState() {
    val k = kind()
    assertEquals(File(own, "config/AGENTS.md"), k.instructionsFile(home, own))
    assertEquals(File(own, "config"), k.configDir(home, own))
    // config.into that holds no state of the agent's stays shared.
    val shared = kind("""{"instructions":".demo.md","state":{"env":{"D":"{{stateDir}}"},"instructions":"demo.md"}}""")
    assertEquals(File(own, "demo.md"), shared.instructionsFile(home, own))
    assertEquals(File(home, ".config/demo"), shared.configDir(home, own))
    // No instructions, no config: nothing to place.
    val bare = kind("""{"instructions":null,"config":null,"state":{"env":{"D":"{{stateDir}}"}}}""")
    assertNull(bare.instructionsFile(home, own))
    assertNull(bare.configDir(home, own))
    assertNull(bare.config)
  }

  @Test fun aKindWithoutStateCannotTakeAStateFolder() {
    val k = kind("""{"state":null}""")
    assertFalse(k.ownStateSupported)
    assertEquals(File("/i/home/.config/demo/AGENTS.md"), k.instructionsFile(home, null))
    val message = "demo keeps no state per agent, so its agents cannot have a state folder of their own"
    assertEquals(message, assertFailsWith<KindException> { k.launch(ctx.copy(stateDir = own)) }.message)
    assertEquals(message, assertFailsWith<KindException> { k.instructionsFile(home, own) }.message)
    assertEquals(message, assertFailsWith<KindException> { k.configDir(home, own) }.message)
  }

  @Test fun stateDirIsOnlyInTheStateEnv() {
    val k = kind("""{"engine":{"style":"tui","launch":{"argv":["demo","{{stateDir}}"]}}}""")
    assertEquals("{{stateDir}} has no value here", assertFailsWith<KindException> { k.launch(ctx.copy(stateDir = own)) }.message)
  }

  @Test fun refusesAStateBlockThatDoesNotFit() {
    for ((patch, message) in listOf(
      """{"state":{"env":{},"instructions":"a.md"}}""" to "demo: state.env moves nothing",
      """{"state":{"env":{"D":"{{stateDir}}"}}}""" to "demo: state.instructions goes with instructions, and only with them",
      """{"instructions":null,"state":{"env":{"D":"{{stateDir}}"},"instructions":"a.md"}}""" to
        "demo: state.instructions goes with instructions, and only with them",
      """{"config":null,"instructions":null,"state":{"env":{"D":"{{stateDir}}"},"config":"c"}}""" to "demo: state.config needs a config block",
    )) {
      assertEquals(message, assertFailsWith<KindException> { kind(patch) }.message, patch)
    }
  }

  @Test fun theTuiClientReadsItToo() {
    val client = """{"surfaces":{"home":"tui","terminal":{"client":{"argv":["demo-tui"],"env":{"DEMO_DATA":"{{home}}/.demo"}}}}}"""
    val ctx = ClientContext("/lib", "/h", "/t", "", "pw", "/h/projects", null)
    val k = kind(client)
    assertEquals("/h/.demo", k.clientRecipe(ctx)!!.env["DEMO_DATA"])
    val own = k.clientRecipe(ctx.copy(stateDir = "/h/.phonecando/agents/a2"))!!
    assertEquals(
      listOf("HOME", "TMPDIR", "TERM", "COLORTERM", "DEMO_DATA", "DEMO_CONFIG_DIR"),
      own.env.keys.toList(),
    )
    assertEquals("/h/.phonecando/agents/a2/data", own.env["DEMO_DATA"])
    assertFailsWith<KindException> { kind(client.dropLast(1) + ""","state":null}""").clientRecipe(ctx.copy(stateDir = "/s")) }
  }

  @Test fun kindViewSaysWhetherAnAgentCanHaveOne() {
    assertTrue(kind().ownStateSupported)
    assertEquals("true", KindView.of(kind(), false) { true }["stateFolder"].toString())
    assertEquals("false", KindView.of(kind("""{"state":null}"""), false) { true }["stateFolder"].toString())
  }

  @Test fun guestPaths() {
    assertEquals("/root/.phonecando/agents/a2", StateSeam.guestPath(File("/i/home/.phonecando/agents/a2/"), File("/i/home/")))
    assertEquals("/root/x", StateSeam.guestPath(File("/i/home/a/../x"), File("/i/home")))
    assertEquals("/root", StateSeam.guestPath(File("/i/home"), File("/i/home")))
    assertFailsWith<KindException> { StateSeam.guestPath(File("/i/homework"), File("/i/home")) }
    assertFailsWith<KindException> { StateSeam.guestPath(File("/i"), File("/i/home")) }
  }
}
