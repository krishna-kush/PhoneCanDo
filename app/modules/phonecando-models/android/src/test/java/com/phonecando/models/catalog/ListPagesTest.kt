package com.phonecando.models.catalog

import com.phonecando.lme.api.http.HttpPort
import com.phonecando.lme.api.http.HttpResponse
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.filters.ModelSize
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.Collections
import java.util.concurrent.Executors

class ListPagesTest {
  private val api = "https://huggingface.co/api/models"
  private val sized = "$api?filter=gguf&filter=conversational&sort=downloads&direction=-1&limit=100"
  private val plain = "$api?filter=gguf&filter=conversational&sort=downloads&direction=-1&limit=30"
  private fun page(n: Int) = "$sized&cursor=p$n"
  private fun hit(repo: String, base: String? = null) =
    """{"id":"$repo","pipeline_tag":"text-generation","tags":[${base?.let { "\"base_model:$it\",\"base_model:quantized:$it\"" } ?: ""}]}"""

  // Four Hub pages; the first page's hits have one of each kind of size.
  private val pages = mapOf(
    sized to (listOf(hit("acme/Big-27B-GGUF"), hit("acme/Tiny-1B-GGUF"), hit("acme/Flash-GGUF", "acme/Flash"), hit("acme/Mystery-GGUF")) to page(2)),
    plain to ((1..10).map { hit("acme/Model-$it") } to "$plain&cursor=x"),
    page(2) to (listOf(hit("acme/Small-0.5B-GGUF")) to page(3)),
    page(3) to (listOf(hit("acme/Mini-2B-GGUF"), hit("acme/Mid-4B-GGUF")) to page(4)),
    page(4) to (listOf(hit("acme/Last-1.5B-GGUF")) to null),
  )
  private val asked: MutableList<String> = Collections.synchronizedList(mutableListOf())
  private val port = HttpPort { url, _ ->
    asked += url
    val listed = pages[url]
    val (status, body, headers) = when {
      listed != null -> Triple(200, listed.first.joinToString(",", "[", "]"), listed.second?.let { mapOf("Link" to listOf("<$it>; rel=\"next\"")) } ?: emptyMap())
      url == "$api/acme/Flash?expand%5B%5D=createdAt&expand%5B%5D=safetensors" ->
        Triple(200, """{"id":"acme/Flash","safetensors":{"parameters":{"BF16":1500000000},"total":1500000000}}""", emptyMap())
      else -> Triple(404, "{}", emptyMap())
    }
    HttpResponse(status, headers, ByteArrayInputStream(body.toByteArray()))
  }
  private val executor = Executors.newCachedThreadPool()
  private val list = ListPages(HubOrigins(executor))
  private val hub = HfCatalog(port)

  @After
  fun stop() {
    executor.shutdownNow()
  }

  @Test
  fun `a size filter keeps what matches over at most three Hub pages, and More goes on`() {
    val first = list.first(hub, "", ModelFilters(size = ModelSize.UP_TO_2B), 30)
    assertEquals(listOf("acme/Tiny-1B-GGUF", "acme/Flash-GGUF", "acme/Small-0.5B-GGUF", "acme/Mini-2B-GGUF"), first.hits.map { it.repo })
    // The one unsized name with an original asks it; one with none asks nothing.
    assertEquals(listOf(sized, "$api/acme/Flash?expand%5B%5D=createdAt&expand%5B%5D=safetensors", page(2), page(3)), asked)
    assertEquals("UP_TO_2B ${page(4)}", first.next)

    val more = list.next(hub, first.next!!)
    assertEquals(listOf("acme/Last-1.5B-GGUF"), more.hits.map { it.repo })
    assertEquals(null, more.next)
    assertEquals(page(4), asked.last())
  }

  @Test
  fun `without a size filter one Hub page of the caller's length`() {
    val first = list.first(hub, "", ModelFilters(), 30)
    assertEquals((1..10).map { "acme/Model-$it" }, first.hits.map { it.repo })
    assertEquals(listOf(plain), asked)
    assertEquals("any $plain&cursor=x", first.next)
  }
}
