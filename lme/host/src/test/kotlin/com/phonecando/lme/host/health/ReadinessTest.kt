package com.phonecando.lme.host.health

import com.phonecando.lme.api.LmeException
import com.phonecando.network.testkit.FakePort
import com.phonecando.network.testkit.noResponse
import com.phonecando.network.testkit.reply
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReadinessTest {
    private var now = 0L
    private val slept = mutableListOf<Long>()

    private fun readiness(vararg seen: Health, alive: () -> Boolean = { true }): Readiness {
        val queue = ArrayDeque(seen.toList())
        return Readiness(
            probe = { if (queue.size > 1) queue.removeFirst() else queue.first() },
            alive = alive,
            clock = { now },
            sleep = { slept += it; now += it },
            timeoutMillis = 2_000,
            pollMillis = 500,
        )
    }

    @Test
    fun `starting, loading, ready`() {
        readiness(Health.Starting, Health.Loading, Health.Loading, Health.Ready).await()
        assertEquals(listOf(500L, 500L, 500L), slept)
    }

    @Test
    fun `a broken answer, a dead process or no answer in time stop the wait`() {
        assertEquals("model server not ready: answered http 500", assertThrows<LmeException.ServerNotReady> { readiness(Health.Failed(500)).await() }.message)
        assertEquals("the server exited", assertThrows<LmeException.ServerNotReady> { readiness(Health.Starting, alive = { false }).await() }.reason)
        assertEquals("not ready after 2 s", assertThrows<LmeException.ServerNotReady> { readiness(Health.Loading).await() }.reason)
        assertThrows<LmeException.Cancelled> { readiness(Health.Loading).await { true } }
    }

    @Test
    fun `probe statuses`() {
        val fake = FakePort()
        val url = "http://127.0.0.1:8099/health"
        fake.on(url, { reply(503, "{}") }, { reply(200, """{"status":"ok"}""") }, { reply(401) }, { noResponse() })
        val probe = HealthProbe(fake)
        assertEquals(Health.Loading, probe.probe(url))
        assertEquals(Health.Ready, probe.probe(url))
        assertEquals(Health.Failed(401), probe.probe(url))
        assertEquals(Health.Starting, probe.probe(url))
        assertNull(fake.requests[0].header("authorization"))
    }
}
