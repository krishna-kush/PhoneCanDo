package com.phonecando.pce.core

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.Fixtures
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class SchedulerTest {
    @Test
    fun concurrentActionsAreSerialized() {
        runBlocking {
            val backend = SlowBackend()
            val pce = Pce.create(backend)
            try {
                val snapshot = pce.observe().getOrThrow()
                val node = snapshot.nodes.first { it.viewId == "com.example:id/search" }
                val action = Action.Tap(Target.Node(node.id))

                coroutineScope {
                    List(2) { async { pce.act(snapshot.id, action).getOrThrow() } }.awaitAll()
                }

                assertEquals(1, backend.maxActive.get())
            } finally {
                pce.close()
            }
        }
    }

    private class SlowBackend : Backend {
        override val id: String = "slow"
        override val capabilities: Set<Capability> = setOf(Capability.OBSERVE, Capability.TAP)

        private val active = AtomicInteger(0)
        val maxActive = AtomicInteger(0)

        override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> =
            PceResult.Ok(Fixtures.rawSnapshot())

        override suspend fun execute(action: BackendAction): PceResult<Unit> {
            val now = active.incrementAndGet()
            maxActive.updateAndGet { previous -> maxOf(previous, now) }
            try {
                delay(50)
            } finally {
                active.decrementAndGet()
            }
            return PceResult.Ok(Unit)
        }

        override suspend fun close() = Unit
    }
}
