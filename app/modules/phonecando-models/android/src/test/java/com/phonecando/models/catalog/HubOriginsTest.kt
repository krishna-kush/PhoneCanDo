package com.phonecando.models.catalog

import com.phonecando.lme.api.http.HttpPort
import com.phonecando.lme.api.http.HttpResponse
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.RepoRevision
import com.phonecando.lme.catalog.known.KnownModels
import com.phonecando.lme.catalog.parameters.ParameterCount
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream
import java.time.LocalDate
import java.util.Collections
import java.util.concurrent.Executors

class HubOriginsTest {
  private val api = "https://huggingface.co/api/models"
  private val expand = "?expand%5B%5D=createdAt&expand%5B%5D=safetensors"
  private val asked: MutableList<String> = Collections.synchronizedList(mutableListOf())
  private val port = HttpPort { url, _ ->
    asked += url
    val body = when (url) {
      "$api/meta-llama/Llama-3.2-1B-Instruct$expand" ->
        """{"id":"meta-llama/Llama-3.2-1B-Instruct","createdAt":"2024-09-18T15:12:47.000Z","safetensors":{"parameters":{"BF16":1235814400},"total":1235814400}}"""
      "$api/Qwen/Qwen3.8-Flash-Next$expand" ->
        """{"id":"Qwen/Qwen3.8-Flash-Next","createdAt":"2026-08-24T08:24:59.000Z","safetensors":{"parameters":{"BF16":179999981424,"I64":35},"total":179999981459}}"""
      else -> null
    }
    HttpResponse(if (body != null) 200 else 404, emptyMap(), ByteArrayInputStream((body ?: "{}").toByteArray()))
  }
  private val executor = Executors.newCachedThreadPool()
  private val day = LocalDate.of(2026, 3, 2)

  @After
  fun stop() {
    executor.shutdownNow()
  }

  private fun hit(repo: String, origin: String) = ModelHit(repo, 0, 0, null, day, origin)

  @Test
  fun `known, own and looked-up dates with one request per original, kept for the next list`() {
    val hits = listOf(
      hit("unsloth/Qwen3.5-4B-GGUF", "Qwen/Qwen3.5-4B"),
      hit("ccore/Coder", "ccore/Coder"),
      hit("bartowski/Llama-3.2-1B-Instruct-GGUF", "meta-llama/Llama-3.2-1B-Instruct"),
      hit("someone/Llama-3.2-1B-Instruct-GGUF", "meta-llama/Llama-3.2-1B-Instruct"),
      hit("acme/Gone-GGUF", "acme/Gone"),
    )
    val origins = HubOrigins(executor)
    val hub = HfCatalog(port)
    origins.lookUp(hub, hits)

    assertEquals(KnownModels.QWEN35_4B.dates, origins.dates(hits[0]))
    assertEquals(ModelDates.OnHub(day), origins.dates(hits[1]))
    val llama = ModelDates.OnHub(LocalDate.of(2024, 9, 18))
    assertEquals(llama, origins.dates(hits[2]))
    assertEquals(llama, origins.dates(hits[3]))
    // Its original is gone (404): no dates, and the list still answers.
    assertNull(origins.dates(hits[4]))
    assertEquals(2, asked.size)

    // The next list asks nothing: the gone original is kept as gone too.
    origins.lookUp(hub, hits)
    assertNull(origins.dates(hits[4]))
    val revision = RepoRevision("bartowski/Llama-3.2-1B-Instruct-GGUF", "0".repeat(40), false, "meta-llama/Llama-3.2-1B-Instruct", day, emptyList())
    assertEquals(llama, origins.dates(hub, revision))
    assertEquals(2, asked.size)
  }

  @Test
  fun `a lookup that fails for a passing reason is asked again by the next list`() {
    var down = true
    val flaky = HttpPort { url, headers -> if (down) HttpResponse(503, emptyMap(), ByteArrayInputStream("{}".toByteArray())) else port.get(url, headers) }
    val hits = listOf(hit("bartowski/Llama-3.2-1B-Instruct-GGUF", "meta-llama/Llama-3.2-1B-Instruct"))
    val origins = HubOrigins(executor)
    origins.lookUp(HfCatalog(flaky), hits)
    assertNull(origins.dates(hits[0]))

    down = false
    origins.lookUp(HfCatalog(flaky), hits)
    assertEquals(ModelDates.OnHub(LocalDate.of(2024, 9, 18)), origins.dates(hits[0]))
  }

  @Test
  fun `sizes from names need no request, and an unsized name asks its original once`() {
    val hits = listOf(
      hit("unsloth/Qwen3.8-27B-GGUF", "Qwen/Qwen3.8-27B"),
      hit("unsloth/Qwen3.8-Flash-Next-GGUF", "Qwen/Qwen3.8-Flash-Next"),
      hit("ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF", "Qwen/Qwen3.8-Flash-Next"),
      hit("ornith-ai/Ornith-GGUF", "ornith-ai/Ornith-GGUF"),
    )
    val origins = HubOrigins(executor)
    origins.lookUpSizes(HfCatalog(port), hits)

    assertEquals(listOf("$api/Qwen/Qwen3.8-Flash-Next$expand"), asked)
    assertEquals(
      listOf(ParameterCount(27_000_000_000L), ParameterCount(179_999_981_459L), ParameterCount(179_999_981_459L), null),
      hits.map(origins::size),
    )
    // Its dates come from the same lookup; only the 27B's original is asked for its dates.
    assertEquals(ModelDates.OnHub(LocalDate.of(2026, 8, 24)), origins.dates(hits[1]))
    origins.lookUp(HfCatalog(port), hits)
    assertEquals(listOf("$api/Qwen/Qwen3.8-27B$expand"), asked.drop(1))
  }
}
