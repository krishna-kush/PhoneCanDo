package com.phonecando.runner.models.prompt

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.api.serve.WireApi
import com.phonecando.runner.models.ModelServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// One look of the prompt watch at a time (tick), short of a real server:
// who it is busy for, when it asks, what it tells and when it ends.
class PromptWatchTest {
  private val key = "ab".repeat(24)
  private val qwen = ModelRecord(
    "qwen3-5-0-8b", "Qwen3.5 0.8B", ModelSource.Imported("q.gguf"),
    listOf(ModelFile("q.gguf", 1, "0".repeat(64))),
    ModelShape("qwen35", null, null, null, null, 1, null, KvCacheShape.NONE), 0,
  )
  private val serving = ModelServer.Serving(
    qwen,
    ServedEndpoint("http://127.0.0.1:9000", qwen.id, key, 16_384, setOf(WireApi.OPENAI_CHAT)),
    setOf("a2", "a1", "a3"),
  )

  private fun slots(processing: Boolean, processed: Long, decoded: Long) =
    """[{"id":0,"is_processing":$processing,"n_prompt_tokens_processed":$processed,""" +
      """"n_prompt_tokens_cache":0,"n_prompt_tokens_total":7300,"next_token":[{"n_decoded":$decoded}]}]"""

  @Test fun busyForTheHoldersWithARunGoing() {
    val target = PromptWatch.busy(listOf(serving), setOf("a3", "a1", "other"))
    assertEquals(listOf("a1", "a3"), target?.agentIds)
    assertEquals("http://127.0.0.1:9000", target?.baseUrl)
    assertEquals("Qwen3.5 0.8B", target?.modelName)
    assertFalse(target.toString().contains(key))
    assertNull(PromptWatch.busy(listOf(serving), setOf("other")))
    assertNull(PromptWatch.busy(emptyList(), setOf("a1")))
  }

  @Test fun withSeveralServersTheFirstBusyOneIsWatched() {
    val gemma = ModelServer.Serving(
      qwen.copy(id = "gemma-3-1b", name = "Gemma 3 1B"),
      ServedEndpoint("http://127.0.0.1:9001", "gemma-3-1b", key, 8_192, setOf(WireApi.OPENAI_CHAT)),
      setOf("b1"),
    )
    assertEquals("gemma-3-1b", PromptWatch.busy(listOf(serving, gemma), setOf("b1"))?.modelId)
    assertEquals("http://127.0.0.1:9001", PromptWatch.busy(listOf(serving, gemma), setOf("b1"))?.baseUrl)
    assertEquals(qwen.id, PromptWatch.busy(listOf(serving, gemma), setOf("b1", "a1"))?.modelId)
  }

  @Test fun asksWhileBusyAndTellsEachChange() {
    var busy: PromptWatch.Target? = PromptWatch.busy(listOf(serving), setOf("a1"))
    var body = slots(true, 0, 0)
    val asked = mutableListOf<Pair<String, String>>()
    val told = mutableListOf<PromptReading?>()
    val watch = PromptWatch({ busy }, { true }, { told += it }, { url, k -> asked += url to k; body })

    assertTrue(watch.tick())
    assertTrue(watch.tick())
    body = slots(true, 2048, 0)
    assertTrue(watch.tick())
    body = slots(true, 7300, 12)
    assertTrue(watch.tick())

    assertEquals("http://127.0.0.1:9000/slots" to key, asked.first())
    assertEquals(listOf(0L, 2048L, null), told.map { it?.read })
    assertEquals(7300L, told.first()?.total)
    assertEquals(listOf("a1"), told.first()?.agentIds)
    assertNull(watch.current())

    busy = null
    assertFalse(watch.tick())
  }

  @Test fun noAskWhileNobodyLooksAndAFailedAskKeepsTheLastAnswer() {
    val busy = PromptWatch.busy(listOf(serving), setOf("a1"))
    var looking = false
    var body: String? = slots(true, 2048, 0)
    var asks = 0
    val watch = PromptWatch({ busy }, { looking }, {}, { _, _ -> asks++; body })

    assertTrue(watch.tick())
    assertEquals(0, asks)
    looking = true
    assertTrue(watch.tick())
    assertEquals(2048L, watch.current()?.read)
    body = null
    assertTrue(watch.tick())
    assertEquals(2048L, watch.current()?.read)
  }

  @Test fun aLocalModelReadingOrWritingIsAtWorkForItsAgents() {
    // The 0.8B model reads a prompt for minutes on our test phone, screen
    // off; an ACP turn's watch reads this as the agent's sign of life.
    val busy = PromptWatch.busy(listOf(serving), setOf("a1"))
    var now = 0L
    var body: String? = slots(true, 0, 0)
    val watch = PromptWatch({ busy }, { true }, {}, { _, _ -> body }, clock = { now })
    assertFalse(watch.working("a1"))
    for (step in 0..150) {
      now = step * PromptWatch.INTERVAL_MS
      body = slots(true, step * 50L, 0)
      watch.tick()
      assertTrue(watch.working("a1"))
    }
    assertFalse(watch.working("a2"))
    // Writing its reply: still at work.
    body = slots(true, 7300, 40)
    watch.tick()
    assertTrue(watch.working("a1"))
    // A failed ask keeps it a short while; done, it is not.
    body = null
    now += PromptWatch.INTERVAL_MS
    watch.tick()
    assertTrue(watch.working("a1"))
    now += PromptWatch.WORK_FRESH_MS
    assertFalse(watch.working("a1"))
    body = slots(false, 7300, 0)
    watch.tick()
    assertFalse(watch.working("a1"))
  }
}
