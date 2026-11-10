package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.ManifestException
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

// A local model in a launch (ModelSeam, ManifestKind.launch), on made-up
// native and image kinds.
class ModelSeamTest {
  private val models = """
    "models": {
      "openai-responses": { "args": ["-c", "base={{baseUrl}}/v1", "-c", "model={{model}}"], "env": { "KEY": "{{modelKey}}" } },
      "anthropic": { "env": { "ANTHROPIC_BASE_URL": "{{baseUrl}}", "ANTHROPIC_AUTH_TOKEN": "{{modelKey}}", "CTX": "{{contextWindow}}" } }
    }
  """

  private fun kind(type: String) = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"m","label":"M","version":"1","type":"$type","channels":["full"],"stability":"stable",
         "requires":{"linux":"${if (type == "image") "required" else "none"}"},
         "engine":{"style":"tui","launch":{"argv":["${if (type == "image") "m" else "{{libDir}}/libm-engine.so"}","resume","--last"],"env":{"A":"1"}},"readiness":{"alive":{}}},
         "phoneTools":"none", $models}""",
    ),
    null,
  )

  private fun endpoint(apis: List<String>) = ModelEndpoint("http://127.0.0.1:8099", "qwen-4b", "k3y", 16384, apis)

  private fun ctx(model: ModelEndpoint?) =
    LaunchContext(libDir = "/lib", home = File("/h"), tmp = File("/t"), port = "", password = "pw", image = File("/img"), model = model)

  @Test fun picksTheKindsFirstChoiceTheServerServes() {
    val k = kind("native")
    assertEquals("openai-responses", k.modelApi(listOf("openai-chat", "openai-responses", "anthropic")))
    assertEquals("anthropic", k.modelApi(listOf("openai-chat", "anthropic")))
    assertNull(k.modelApi(listOf("openai-chat")))
  }

  @Test fun argsGoRightAfterTheProgramAndTheKeyOnlyInEnv() {
    val spec = kind("native").launch(ctx(endpoint(listOf("openai-responses"))))
    assertEquals(
      listOf("/lib/libm-engine.so", "-c", "base=http://127.0.0.1:8099/v1", "-c", "model=qwen-4b", "resume", "--last"),
      spec.argv,
    )
    assertEquals(mapOf("A" to "1", "KEY" to "k3y"), spec.env)
    assertTrue(spec.argv.none { "k3y" in it })
  }

  @Test fun anImageKindGetsItBeforeItsShellWrapsIt() {
    val spec = kind("image").launch(ctx(endpoint(listOf("anthropic"))))
    assertEquals(listOf("m", "resume", "--last"), spec.argv.takeLast(3))
    assertEquals("http://127.0.0.1:8099", spec.env["ANTHROPIC_BASE_URL"])
    assertEquals("16384", spec.env["CTX"])
    assertEquals("/root", spec.env["HOME"])
  }

  @Test fun noModelLeavesTheLaunchAsItWas() {
    assertEquals(kind("native").launch(ctx(null)).argv, listOf("/lib/libm-engine.so", "resume", "--last"))
  }

  @Test fun aServerItCannotUseIsRefused() {
    assertFailsWith<KindException> { kind("native").launch(ctx(endpoint(listOf("openai-chat")))) }
  }

  @Test fun aNativeKindsMachineNeverSeesTheModelKey() {
    val unset = GuestEnvPolicy.unset(kind("native").manifest)
    assertTrue("KEY" in unset && "ANTHROPIC_AUTH_TOKEN" in unset, "$unset")
    assertTrue("ANTHROPIC_BASE_URL" !in unset)
  }

  @Test fun theViewListsTheApisInOrder() {
    val view = KindView.of(kind("native"), isDefault = false) { true }
    assertEquals("""["openai-responses","anthropic"]""", view["models"].toString())
  }

  @Test fun anUnknownApiIsRefused() {
    val e = assertFailsWith<ManifestException> {
      ManifestDecoder.decode(
        """{"schema":1,"id":"m","label":"M","version":"1","type":"native","channels":["full"],"stability":"stable",
           "models":{"gemini":{"env":{"A":"b"}}}}""",
      )
    }
    assertEquals("/models/gemini", e.path)
  }
}
