package com.phonecando.pce.core

import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class VerifierTest {
    private val verifier = Verifier()
    private lateinit var pce: Pce
    private lateinit var snapshot: Snapshot

    @BeforeEach
    fun setUp() {
        runBlocking {
            pce = Pce.create(FakeBackend(Fixtures.rawSnapshot()))
            snapshot = pce.observe().getOrThrow()
        }
    }

    @AfterEach
    fun tearDown() {
        runBlocking { pce.close() }
    }

    @Test
    fun existsResolvesNode() {
        val resolved = verifier.exists(
            snapshot,
            Selector(viewId = "com.example:id/search"),
        ).getOrThrow()

        assertEquals(NodeId(1), resolved.node.id)
    }

    @Test
    fun absentPassesWhenNothingMatches() {
        verifier.absent(snapshot, Selector(text = "Nope")).getOrThrow()
    }

    @Test
    fun absentFailsWhenNodeMatches() {
        val result = verifier.absent(snapshot, Selector(viewId = "com.example:id/search"))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.ASSERTION_FAILED, error.code)
    }

    @Test
    fun absentPropagatesAmbiguity() {
        val result = verifier.absent(snapshot, Selector(text = "Add"))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.AMBIGUOUS, error.code)
    }

    @Test
    fun stableAcceptsStableSnapshot() {
        verifier.stable(snapshot).getOrThrow()
    }

    @Test
    fun stableRejectsUnstableSnapshot() {
        runBlocking {
            val unstablePce = Pce.create(
                FakeBackend(Fixtures.rawSnapshot(stable = false))
            )
            try {
                val unstable = unstablePce.observe().getOrThrow()
                val result = verifier.stable(unstable)
                val error = (result as PceResult.Err).error

                assertEquals(ErrorCode.ASSERTION_FAILED, error.code)
            } finally {
                unstablePce.close()
            }
        }
    }
}
