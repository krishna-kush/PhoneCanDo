package com.phonecando.runner.models

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.api.serve.WireApi
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.TestKinds
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.PortAllocator
import com.phonecando.runner.engine.proc.ProcessReaper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// The join of agents and local models, short of a real server: which kinds
// may have one, the fast refusals before a start, lme's endpoint as the
// kit takes it, and what a kind then renders from it.
class LocalModelBindingTest {
  private val key = "ab".repeat(24)
  private val qwen = ModelRecord(
    "qwen3-5-4b-q4-k-m", "Qwen3.5 4B", ModelSource.Imported("q.gguf"),
    listOf(ModelFile("q.gguf", 1, "0".repeat(64))),
    ModelShape("qwen35", null, null, null, null, 1, null, KvCacheShape.NONE), 0,
  )

  private val server = ModelServer(
    ports = PortAllocator({ true }, { 9000 }),
    reaper = ProcessReaper({ emptyList() }, object : ProcessReaper.Signals {
      override fun term(pid: Int) {}
      override fun kill(pid: Int) {}
    }, 1, 1),
    libDir = "/nowhere",
    logFile = File("/nowhere/model-server.log"),
    device = { throw AssertionError("no device read in these tests") },
    modelFile = { File("/nowhere/${it.id}") },
    onDied = { _, _ -> },
  )
  private val binding = LocalModelBinding(server) { listOf(qwen) }

  private fun agent(kind: String, model: String?) =
    AgentRecord("a1", kind, "Agent", "img1", null, "p".repeat(48), "t".repeat(48), 0, model = model)

  private fun kind(id: String) = checkNotNull(TestKinds.catalog.get(id)) { "no kind $id" }

  @Test fun kindsWithAModelsBlockTakeOne() {
    assertTrue(LocalModelBinding.accepts(kind("opencode")))
    assertFalse(LocalModelBinding.accepts(kind("gemini-cli")))
  }

  @Test fun ourServerSpeaksEveryWireApi() {
    assertEquals(listOf("openai-chat", "openai-responses", "anthropic"), LocalModelBinding.SERVED)
  }

  @Test fun anAgentWithoutAModelNeedsNothing() {
    binding.check(agent("gemini-cli", null), kind("gemini-cli"))
    assertNull(binding.endpoint(agent("opencode", null), kind("opencode")))
  }

  @Test fun aKindWithoutModelsIsNeverGivenOne() {
    val e = assertThrows(EngineStartException::class.java) { binding.check(agent("gemini-cli", qwen.id), kind("gemini-cli")) }
    assertEquals(EngineStartError.MODEL_UNAVAILABLE, e.error)
    assertEquals("model_unavailable: Gemini CLI can't use a local model", e.message)
    assertThrows(EngineStartException::class.java) { binding.endpoint(agent("gemini-cli", qwen.id), kind("gemini-cli")) }
  }

  @Test fun aModelGoneFromThePhoneIsRefused() {
    val e = assertThrows(EngineStartException::class.java) { binding.check(agent("opencode", "gone"), kind("opencode")) }
    assertEquals("model_unavailable: its model (gone) is no longer on this phone", e.message)
    binding.check(agent("opencode", qwen.id), kind("opencode"))
  }

  @Test fun lmesEndpointAsTheKitTakesIt() {
    val served = ServedEndpoint("http://127.0.0.1:8099", qwen.id, key, 16_384, setOf(WireApi.ANTHROPIC, WireApi.OPENAI_CHAT))
    assertEquals(
      ModelEndpoint("http://127.0.0.1:8099", qwen.id, key, 16_384, listOf("openai-chat", "anthropic")),
      LocalModelBinding.endpointOf(served),
    )
  }

  @Test fun opencodeIsWiredToTheServer() {
    val endpoint = ModelEndpoint("http://127.0.0.1:8099", qwen.id, key, 16_384, LocalModelBinding.SERVED)
    val ctx = LaunchContext("/lib", File("/home"), File("/tmp"), "4096", "pw", model = endpoint)
    val spec = kind("opencode").launch(ctx)
    assertEquals(key, spec.env["LOCAL_MODEL_KEY"])
    val config = spec.env.getValue("OPENCODE_CONFIG_CONTENT")
    assertTrue(config.contains("\"baseURL\":\"http://127.0.0.1:8099/v1\""))
    assertTrue(config.contains("\"model\":\"phonecando-local/${qwen.id}\""))
    assertFalse(config.contains(key))
    assertFalse(spec.argv.any { key in it })
  }

  @Test fun reasonsReadAsSentences() {
    assertEquals("6.2 GB", ModelReasons.gb(6_217_393_376))
    assertEquals(
      "Qwen3.5 9B needs 6.2 GB of RAM, more than this phone can spare (3.9 GB)",
      ModelReasons.tooBig("Qwen3.5 9B", 6_217_393_376, 3_871_000_000),
    )
    assertEquals("its model server (Qwen) stopped", ModelReasons.exited("Qwen", null))
    assertEquals("its model server (Qwen) stopped with exit code 1", ModelReasons.exited("Qwen", 1))
  }
}
