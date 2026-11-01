package com.phonecando.pce.core

import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.Near
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.Point
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

class ResolverTest {
    private val resolver = Resolver()
    private lateinit var pce: Pce
    private lateinit var snapshot: Snapshot

    @BeforeEach
    fun setUp() = runBlocking {
        pce = Pce.create(FakeBackend(Fixtures.rawSnapshot()))
        snapshot = pce.observe().getOrThrow()
    }

    @AfterEach
    fun tearDown() = runBlocking {
        pce.close()
    }

    @Test
    fun resolvesByViewId() {
        val resolved = resolver.resolve(
            snapshot,
            Selector(viewId = "com.example:id/search"),
        ).getOrThrow()

        assertEquals(snapshot.id, resolved.snapshotId)
        assertEquals("Search", resolved.node.text)
        assertEquals(NodeId(1), resolved.node.id)
    }

    @Test
    fun exactTextIsAmbiguousWhenMultipleNodesMatch() {
        val result = resolver.resolve(snapshot, Selector(text = "Add"))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.AMBIGUOUS, error.code)
        assertEquals(listOf(NodeId(2), NodeId(3)), error.candidates)
    }

    @Test
    fun indexDisambiguates() {
        val resolved = resolver.resolve(
            snapshot,
            Selector(text = "Add", index = 1),
        ).getOrThrow()

        assertEquals("com.example:id/add2", resolved.node.viewId)
    }

    @Test
    fun parentSelectorFiltersChildren() {
        val resolved = resolver.resolve(
            snapshot,
            Selector(
                text = "Add",
                parent = Selector(viewId = "com.example:id/root"),
                index = 0,
            ),
        ).getOrThrow()

        assertEquals("com.example:id/add", resolved.node.viewId)
    }

    @Test
    fun nearSelectorFiltersByCenterDistance() {
        val resolved = resolver.resolve(
            snapshot,
            Selector(
                text = "Add",
                near = Near(Point(300, 450), radius = 100),
            ),
        ).getOrThrow()

        assertEquals("com.example:id/add", resolved.node.viewId)
    }

    @Test
    fun textContainsIsCaseInsensitive() {
        val resolved = resolver.resolve(
            snapshot,
            Selector(textContains = "sea"),
        ).getOrThrow()

        assertEquals("com.example:id/search", resolved.node.viewId)
    }

    @Test
    fun emptySelectorIsInvalid() {
        val result = resolver.resolve(snapshot, Selector(index = 0))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.INVALID_SELECTOR, error.code)
    }

    @Test
    fun missingTextReturnsNotFound() {
        val result = resolver.resolve(snapshot, Selector(text = "Nope"))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.NOT_FOUND, error.code)
    }

    @Test
    fun outOfRangeIndexReturnsNotFound() {
        val result = resolver.resolve(snapshot, Selector(text = "Add", index = 2))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.NOT_FOUND, error.code)
    }
}
