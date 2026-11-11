package com.phonecando.network.retry

import com.phonecando.network.CancelSignal
import com.phonecando.network.NetException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

class RetryLoopTest {
    private var t = 0L
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
    private val sleeper: (Long) -> Unit = { slept += it; t += it }
    private val dropped = NetException.Network("https://cdn/x", null)

    private fun loop(online: () -> Boolean = { true }) = RetryLoop(online, now = { t }, pollMillis = 1_000, sleeper = sleeper)

    private fun run(online: () -> Boolean = { true }, cancel: CancelSignal = CancelSignal.NEVER, tryOnce: () -> Unit) =
        loop(online).run(sink, cancel, tryOnce)

    @Test
    fun `a failure it may retry waits and tries again`() {
        var tries = 0
        run { if (++tries < 3) throw dropped }
        assertEquals(3, tries)
        assertEquals(2_000L + 5_000L, slept.sum())
        assertEquals(listOf(1, 2), sink.waits.map { it.attempt })
        assertEquals(RetryWait.Reason.NETWORK, sink.waits.first().reason)
    }

    @Test
    fun `a rate limit says so on its wait`() {
        var tries = 0
        run { if (++tries < 2) throw IllegalStateException("mapped", NetException.RateLimited("https://cdn/x", 3)) }
        assertEquals(RetryWait.Reason.RATE_LIMITED, sink.waits.single().reason)
        assertEquals(3_000L, sink.waits.single().delayMillis)
    }

    @Test
    fun `one it may not retry ends at once`() {
        var tries = 0
        assertThrows<NetException.DigestMismatch> { run { tries++; throw NetException.DigestMismatch("x", "a", "b") } }
        assertEquals(1, tries)
    }

    @Test
    fun `tries run out without progress, and progress starts the count over`() {
        var tries = 0
        assertThrows<NetException.Network> { run { tries++; throw dropped } }
        assertEquals(RetryPolicy.DOWNLOAD.maxAttempts + 1, tries)

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
        run(online = { ++checks > 3 }) { if (++tries == 1) throw dropped }
        assertEquals(2, tries)
        assertEquals(1, sink.offline)
        assertEquals(emptyList<RetryWait>(), sink.waits)
        assertEquals(2_000L, slept.sum())
    }

    @Test
    fun `an outage longer than the limit gives up with the network error`() {
        assertThrows<NetException.Network> { run(online = { false }) { throw dropped } }
        assertEquals(1, sink.offline)
        assertEquals(RetryPolicy.MAX_OFFLINE_MS, t)
    }

    @Test
    fun `a cancelled job is not tried again, and a cancel cuts its wait`() {
        var tries = 0
        assertThrows<NetException.Network> { run(cancel = { true }) { tries++; throw dropped } }
        assertEquals(1, tries)

        // Cancelled two slices into the 2 s wait.
        assertThrows<NetException.Cancelled> { run(cancel = { slept.size >= 2 }) { throw dropped } }
        assertEquals(listOf(250L, 250L), slept)
    }
}
