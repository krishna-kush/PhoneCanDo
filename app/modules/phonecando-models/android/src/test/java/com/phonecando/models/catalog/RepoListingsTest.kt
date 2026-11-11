package com.phonecando.models.catalog

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.HubCallsLeft
import com.phonecando.network.http.HttpPort
import com.phonecando.network.http.HttpResponse
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class RepoListingsTest {
  private val api = "https://huggingface.co/api/models"
  private val asked: MutableList<String> = Collections.synchronizedList(mutableListOf())
  private val sha256 = "a".repeat(64)
  private val body = """{"sha":"${"0".repeat(40)}","siblings":[{"rfilename":"m-Q4_K_M.gguf","size":5,"lfs":{"sha256":"$sha256","size":5}}]}"""

  // acme/gone answers 404; every other repository answers [body]. [hold] keeps answers back until it opens.
  private var hold: CountDownLatch? = null
  private val port = HttpPort { url, _ ->
    asked += url.substringBefore('?').removePrefix("$api/").removeSuffix("/revision/main")
    hold?.await(5, TimeUnit.SECONDS)
    val status = if (url.startsWith("$api/acme/gone/")) 404 else 200
    HttpResponse(status, emptyMap(), ByteArrayInputStream((if (status == 200) body else "{}").toByteArray()))
  }
  private val executor = Executors.newCachedThreadPool()

  @After
  fun stop() {
    executor.shutdownNow()
  }

  @Test
  fun `a repository is asked once, then kept for the list and its page alike`() {
    val listings = RepoListings(executor)
    val hub = HfCatalog(port)
    assertNull(listings.kept("acme/a"))
    listings.lookUp(hub, listOf("acme/a", "acme/b", "acme/a"))
    assertEquals(listOf("acme/a", "acme/b"), asked.sorted())

    val page = listings.get(hub, "acme/a")
    assertSame(listings.kept("acme/a"), page)
    assertEquals(listOf("m-Q4_K_M.gguf"), page.files.map { it.path })
    listings.lookUp(hub, listOf("acme/a", "acme/b"))
    assertEquals(2, asked.size)
  }

  @Test
  fun `two asks at once share one request`() {
    hold = CountDownLatch(1)
    val listings = RepoListings(executor)
    val hub = HfCatalog(port)
    val first = executor.submit<Any> { listings.get(hub, "acme/a") }
    val second = executor.submit<Any> { listings.get(hub, "acme/a") }
    while (asked.isEmpty()) Thread.sleep(5)
    Thread.sleep(50)
    hold?.countDown()
    assertSame(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS))
    assertEquals(listOf("acme/a"), asked)
  }

  @Test
  fun `a failed request is not kept, so the list goes on, the page gets the error and a later ask tries again`() {
    val listings = RepoListings(executor)
    val hub = HfCatalog(port)
    listings.lookUp(hub, listOf("acme/gone", "acme/a"))
    assertNull(listings.kept("acme/gone"))
    assertNotNull(listings.kept("acme/a"))
    assertThrows(LmeException.NotFound::class.java) { listings.get(hub, "acme/gone") }
    assertEquals(listOf("acme/a", "acme/gone", "acme/gone"), asked.sorted())
  }

  @Test
  fun `the list holds back while the Hub has under a hundred calls left, and a repository the user opens still goes`() {
    val callsLeft = HubCallsLeft().apply { note("\"api\";r=99;t=300") }
    val listings = RepoListings(executor)
    val hub = HfCatalog(port, callsLeft = callsLeft)
    listings.lookUp(hub, listOf("acme/a", "acme/b"))
    assertEquals(0, asked.size)
    listings.get(hub, "acme/a")
    assertEquals(listOf("acme/a"), asked)

    callsLeft.note("\"api\";r=100;t=300")
    listings.lookUp(hub, listOf("acme/a", "acme/b"))
    assertEquals(listOf("acme/a", "acme/b"), asked)
  }
}
