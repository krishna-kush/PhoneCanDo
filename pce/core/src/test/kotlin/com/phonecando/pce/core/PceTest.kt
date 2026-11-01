package com.phonecando.pce.core

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.ScrollDirection
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PceTest {
    private lateinit var backend: FakeBackend
    private lateinit var pce: Pce
    private lateinit var snapshot: Snapshot

    @BeforeEach
    fun setUp() = runBlocking {
        backend = FakeBackend(Fixtures.rawSnapshot())
        pce = Pce.create(backend)
        snapshot = pce.observe().getOrThrow()
    }

    @AfterEach
    fun tearDown() = runBlocking {
        pce.close()
    }

    @Test
    fun observeAssignsDenseNodeIds() {
        snapshot.nodes.forEachIndexed { index, node ->
            assertEquals(index, node.id.value)
        }
    }

    @Test
    fun staleSnapshotIsRejected() = runBlocking {
        val first = snapshot
        pce.observe().getOrThrow()

        val result = pce.resolve(first.id, Selector(viewId = "com.example:id/search"))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.STALE_SNAPSHOT, error.code)
    }

    @Test
    fun tapByNodeSendsBackendIdentity() = runBlocking {
        val node = snapshot.node(com.phonecando.pce.api.NodeId(1))!!

        pce.act(snapshot.id, Action.Tap(Target.Node(node.id))).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.Tap(backendNodeId = BackendNodeId("search")),
            backend.executed.single(),
        )
    }

    @Test
    fun tapBySelectorResolvesBeforeSending() = runBlocking {
        pce.act(
            snapshot.id,
            Action.Tap(Target.BySelector(Selector(viewId = "com.example:id/add"))),
        ).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.Tap(backendNodeId = BackendNodeId("add")),
            backend.executed.single(),
        )
    }

    @Test
    fun tapByCoordinatesSendsPoint() = runBlocking {
        pce.act(
            snapshot.id,
            Action.Tap(Target.Coordinates(Point(10, 20))),
        ).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.Tap(point = Point(10, 20)),
            backend.executed.single(),
        )
    }

    @Test
    fun assertDoesNotCallBackend() = runBlocking {
        pce.act(
            snapshot.id,
            Action.Assert(Selector(viewId = "com.example:id/search")),
        ).getOrThrow()

        assertTrue(backend.executed.isEmpty())
    }

    @Test
    fun assertMissingNodeReturnsNotFound() = runBlocking {
        val result = pce.act(
            snapshot.id,
            Action.Assert(Selector(text = "Nope")),
        )
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.NOT_FOUND, error.code)
    }

    @Test
    fun unsupportedCapabilityIsRejectedBeforeBackendCall() = runBlocking {
        val limited = FakeBackend(
            Fixtures.rawSnapshot(),
            capabilities = setOf(Capability.OBSERVE),
        )
        val limitedPce = Pce.create(limited)
        try {
            val current = limitedPce.observe().getOrThrow()
            val node = current.node(com.phonecando.pce.api.NodeId(1))!!
            val result = limitedPce.act(current.id, Action.Tap(Target.Node(node.id)))
            val error = (result as PceResult.Err).error

            assertEquals(ErrorCode.UNSUPPORTED_ACTION, error.code)
            assertTrue(limited.executed.isEmpty())
        } finally {
            limitedPce.close()
        }
    }

    @Test
    fun everyCapabilityIsEnforcedBeforeBackendCall() {
        runBlocking {
            val cases = listOf(
                Capability.TAP to Action.Tap(Target.Coordinates(Point(1, 1))),
                Capability.LONG_PRESS to Action.LongPress(Target.Coordinates(Point(1, 1))),
                Capability.SET_TEXT to Action.TypeText("x"),
                Capability.KEY to Action.Key(KeyCode.BACK),
                Capability.SCROLL to Action.Scroll(ScrollDirection.DOWN),
                Capability.SWIPE to Action.Swipe(Point(1, 1), Point(2, 2)),
                Capability.LAUNCH to Action.Launch("com.example"),
                Capability.SCREENSHOT to Action.Screenshot(),
            )

            for ((required, action) in cases) {
                val limited = FakeBackend(
                    Fixtures.rawSnapshot(),
                    capabilities = setOf(Capability.OBSERVE),
                )
                val limitedPce = Pce.create(limited)
                try {
                    val current = limitedPce.observe().getOrThrow()
                    val result = limitedPce.act(current.id, action)
                    val error = (result as PceResult.Err).error

                    assertEquals(
                        ErrorCode.UNSUPPORTED_ACTION,
                        error.code,
                        "expected $required to be enforced for $action",
                    )
                    assertTrue(limited.executed.isEmpty())
                } finally {
                    limitedPce.close()
                }
            }
        }
    }

    @Test
    fun invalidLongPressDurationIsRejected() = runBlocking {
        val node = snapshot.node(com.phonecando.pce.api.NodeId(1))!!
        val result = pce.act(
            snapshot.id,
            Action.LongPress(Target.Node(node.id), durationMs = 0),
        )
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.INVALID_ACTION, error.code)
    }

    @Test
    fun typeTextUsesFocusedNode() = runBlocking {
        pce.act(
            snapshot.id,
            Action.TypeText("hello", clear = true),
        ).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.SetText(BackendNodeId("search"), "hello", clear = true),
            backend.executed.single(),
        )
    }

    @Test
    fun typeTextWithoutFocusedNodeReturnsNotFound() = runBlocking {
        val noFocus = FakeBackend(Fixtures.rawSnapshot(focused = null))
        val noFocusPce = Pce.create(noFocus)
        try {
            val current = noFocusPce.observe().getOrThrow()
            val result = noFocusPce.act(current.id, Action.TypeText("hello"))
            val error = (result as PceResult.Err).error

            assertEquals(ErrorCode.NOT_FOUND, error.code)
        } finally {
            noFocusPce.close()
        }
    }

    @Test
    fun typeTextRejectsNonEditableNode() = runBlocking {
        val add = snapshot.nodes.first { it.viewId == "com.example:id/add" }
        val result = pce.act(
            snapshot.id,
            Action.TypeText("hello", target = Target.Node(add.id)),
        )
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.NOT_EDITABLE, error.code)
    }

    @Test
    fun waitReturnsImmediatelyWhenSelectorMatches() = runBlocking {
        pce.act(
            snapshot.id,
            Action.Wait(Selector(viewId = "com.example:id/search"), timeoutMs = 1_000),
        ).getOrThrow()

        assertEquals(1, backend.observations)
    }

    @Test
    fun waitTimesOutWithoutMatch() = runBlocking {
        val result = pce.act(
            snapshot.id,
            Action.Wait(Selector(text = "Nope"), timeoutMs = 50),
        )
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.TIMEOUT, error.code)
        assertTrue(backend.observations >= 2)
    }

    @Test
    fun longPressSendsNodeAndDuration() = runBlocking {
        val node = snapshot.nodes.first { it.viewId == "com.example:id/search" }

        pce.act(
            snapshot.id,
            Action.LongPress(Target.Node(node.id), durationMs = 700),
        ).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.LongPress(
                backendNodeId = BackendNodeId("search"),
                durationMs = 700,
            ),
            backend.executed.single(),
        )
    }

    @Test
    fun keySendsKeyCode() = runBlocking {
        pce.act(snapshot.id, Action.Key(KeyCode.BACK)).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(BackendAction.Key(KeyCode.BACK), backend.executed.single())
    }

    @Test
    fun scrollSendsNodeDirectionAndAmount() = runBlocking {
        val node = snapshot.nodes.first { it.viewId == "com.example:id/search" }

        pce.act(
            snapshot.id,
            Action.Scroll(
                direction = ScrollDirection.DOWN,
                target = Target.Node(node.id),
                amount = 0.5f,
            ),
        ).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.Scroll(
                backendNodeId = BackendNodeId("search"),
                direction = ScrollDirection.DOWN,
                amount = 0.5f,
            ),
            backend.executed.single(),
        )
    }

    @Test
    fun swipeSendsPointsAndDuration() = runBlocking {
        pce.act(
            snapshot.id,
            Action.Swipe(Point(1, 2), Point(3, 4), durationMs = 250),
        ).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.Swipe(Point(1, 2), Point(3, 4), durationMs = 250),
            backend.executed.single(),
        )
    }

    @Test
    fun screenshotSendsFullFlag() = runBlocking {
        pce.act(snapshot.id, Action.Screenshot(full = true)).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(BackendAction.Screenshot(full = true), backend.executed.single())
    }

    @Test
    fun launchSendsPackageAndActivity() = runBlocking {
        pce.act(snapshot.id, Action.Launch("com.example", ".Main")).getOrThrow()

        assertEquals(1, backend.executed.size)
        assertEquals(
            BackendAction.Launch("com.example", ".Main"),
            backend.executed.single(),
        )
    }

    @Test
    fun closeClearsCurrentSnapshot() = runBlocking {
        pce.close()

        val result = pce.resolve(snapshot.id, Selector(viewId = "com.example:id/search"))
        val error = (result as PceResult.Err).error

        assertEquals(ErrorCode.STALE_SNAPSHOT, error.code)
    }
}
