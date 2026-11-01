@file:OptIn(com.phonecando.pce.api.ExperimentalPceApi::class)

package com.phonecando.pce.core

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.SnapshotId
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.TraceEvent
import com.phonecando.pce.api.TraceKind
import com.phonecando.pce.api.TraceSink
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class TraceTest {
    @Test
    fun recordsObserveResolveAndAction() {
        runBlocking {
            val trace = RingBufferTraceSink()
            val pce = Pce.createWithTrace(FakeBackend(Fixtures.rawSnapshot()), trace)
            try {
                val snapshot = pce.observe().getOrThrow()
                val resolved = pce.resolve(
                    snapshot.id,
                    Selector(viewId = "com.example:id/search"),
                ).getOrThrow()
                val tap = Action.Tap(Target.Node(resolved.node.id))
                pce.act(snapshot.id, tap).getOrThrow()

                val events = trace.snapshot()
                assertEquals(
                    listOf(TraceKind.OBSERVE, TraceKind.RESOLVE, TraceKind.ACTION),
                    events.map { it.kind },
                )
                assertEquals(listOf(1L, 2L, 3L), events.map { it.sequence })
                assertEquals(snapshot.id, events[0].snapshotId)
                assertEquals(snapshot.id, events[1].snapshotId)
                assertEquals(resolved.node.id, events[1].nodeId)
                assertEquals(tap, events[2].action)
                assertEquals("fake", events[2].backend)
                assertNotNull(events[0].durationMs)
            } finally {
                pce.close()
            }
        }
    }

    @Test
    fun recordsTypedErrors() = runBlocking {
        val trace = RingBufferTraceSink()
        val pce = Pce.createWithTrace(FakeBackend(Fixtures.rawSnapshot()), trace)
        try {
            val snapshot = pce.observe().getOrThrow()
            val missing = pce.resolve(snapshot.id, Selector(text = "Nope"))
            assertEquals(ErrorCode.NOT_FOUND, (missing as PceResult.Err).error.code)

            val stale = pce.act(SnapshotId(999), Action.Key(KeyCode.BACK))
            assertEquals(ErrorCode.STALE_SNAPSHOT, (stale as PceResult.Err).error.code)

            val events = trace.snapshot()
            assertEquals(TraceKind.RESOLVE, events[1].kind)
            assertEquals(ErrorCode.NOT_FOUND, events[1].error?.code)
            assertEquals(TraceKind.ACTION, events[2].kind)
            assertEquals(ErrorCode.STALE_SNAPSHOT, events[2].error?.code)
        } finally {
            pce.close()
        }
    }

    @Test
    fun ringBufferKeepsOnlyCapacity() {
        val trace = RingBufferTraceSink(capacity = 2)
        repeat(3) { index ->
            trace.record(
                TraceEvent(
                    sequence = (index + 1).toLong(),
                    atMs = index.toLong(),
                    kind = TraceKind.CLOSE,
                )
            )
        }

        assertEquals(2, trace.size)
        assertEquals(listOf(2L, 3L), trace.snapshot().map { it.sequence })
        assertEquals(listOf(3L), trace.last(1).map { it.sequence })
        trace.clear()
        assertEquals(0, trace.size)
    }

    @Test
    fun traceFailureDoesNotBreakAction() {
        runBlocking {
            val throwing = TraceSink { throw IllegalStateException("trace is down") }
            val pce = Pce.createWithTrace(FakeBackend(Fixtures.rawSnapshot()), throwing)
            try {
                val snapshot = pce.observe().getOrThrow()
                val node = snapshot.nodes.first { it.viewId == "com.example:id/search" }
                pce.act(snapshot.id, Action.Tap(Target.Node(node.id))).getOrThrow()
            } finally {
                pce.close()
            }
        }
    }
}
