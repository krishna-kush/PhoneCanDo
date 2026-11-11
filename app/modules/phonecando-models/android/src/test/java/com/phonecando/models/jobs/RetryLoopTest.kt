package com.phonecando.models.jobs

import com.phonecando.lme.api.LmeException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RetryLoopTest {
  private var t = 0L
  private var online = true
  private val slept = ArrayList<Long>()
  private val sink = object : RetrySink {
    override var mostDone = 0L
    val waits = ArrayList<RetryWait>()
    var offline = 0

    override fun retrying(wait: RetryWait) {
      waits += wait
    }

    override fun waitingForNetwork() {
      offline++
    }
  }
  private val loop = RetryLoop(online = { online }, now = { t }, pollMillis = 1_000)
  private val dropped = LmeException.Network("https://cdn/x", null)

  private fun run(tryOnce: () -> Unit) = loop.run(sink, { false }, { slept += it; t += it }, tryOnce)

  @Test
  fun `a failure it may retry waits and tries again`() {
    var tries = 0
    run { if (++tries < 3) throw dropped }
    assertEquals(3, tries)
    assertEquals(listOf(2_000L, 5_000L), slept)
    assertEquals(listOf(1, 2), sink.waits.map { it.attempt })
  }

  @Test
  fun `one it may not retry ends at once`() {
    var tries = 0
    assertThrows(LmeException.DigestMismatch::class.java) { run { tries++; throw LmeException.DigestMismatch("x", "a", "b") } }
    assertEquals(1, tries)
  }

  @Test
  fun `tries run out without progress, and progress starts the count over`() {
    var tries = 0
    assertThrows(LmeException.Network::class.java) { run { tries++; throw dropped } }
    assertEquals(RetryPolicy.MAX_ATTEMPTS + 1, tries)

    tries = 0
    sink.waits.clear()
    run {
      tries++
      sink.mostDone += 10
      if (tries < 10) throw dropped
    }
    assertEquals(10, tries)
    assertEquals(List(9) { 1 }, sink.waits.map { it.attempt })
  }

  @Test
  fun `an outage waits for the network without using up the tries, then tries at once`() {
    var tries = 0
    var checks = 0
    // Offline for the failure and two checks after it.
    val loop = RetryLoop(online = { ++checks > 3 }, now = { t }, pollMillis = 1_000)
    loop.run(sink, { false }, { slept += it; t += it }) { if (++tries == 1) throw dropped }
    assertEquals(2, tries)
    assertEquals(1, sink.offline)
    assertEquals(emptyList<RetryWait>(), sink.waits)
    assertEquals(listOf(1_000L, 1_000L), slept)
  }

  @Test
  fun `an outage longer than the limit gives up with the network error`() {
    online = false
    assertThrows(LmeException.Network::class.java) { run { throw dropped } }
    assertEquals(1, sink.offline)
    assertEquals(RetryPolicy.MAX_OFFLINE_MS, t)
  }

  @Test
  fun `a cancelled job is not tried again`() {
    var tries = 0
    assertThrows(LmeException.Network::class.java) { loop.run(sink, { true }, { slept += it }) { tries++; throw dropped } }
    assertEquals(1, tries)
  }
}
