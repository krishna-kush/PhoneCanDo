package com.phonecando.pce.core

import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.RawNode
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.FakeBackend
import com.phonecando.pce.testkit.Fixtures
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SnapshotAssemblerTest {
    @Test
    fun linksParentsChildrenAndFocus() = runBlocking {
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot()))
        try {
            val snapshot = pce.observe().getOrThrow()

            assertEquals(NodeId(1), snapshot.focusedNodeId)
            assertEquals(NodeId(0), snapshot.nodes[1].parentId)
            assertEquals(listOf(NodeId(1), NodeId(2), NodeId(3)), snapshot.nodes[0].childIds)
            assertEquals(listOf(NodeId(0)), snapshot.roots.map { it.id })
        } finally {
            pce.close()
        }
    }

    @Test
    fun preservesBackendIdentity() = runBlocking {
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot()))
        try {
            val snapshot = pce.observe().getOrThrow()

            assertEquals(BackendNodeId("search"), snapshot.nodes[1].backendId)
        } finally {
            pce.close()
        }
    }

    @Test
    fun rejectsDuplicateBackendIds() = runBlocking {
        val duplicate = RawNode(
            backendId = BackendNodeId("root"),
            parentBackendId = null,
            depth = 0,
            packageName = "com.example",
            className = "android.widget.FrameLayout",
            viewId = null,
            text = null,
            contentDescription = null,
            bounds = Bounds(0, 0, 10, 10),
            flags = setOf(NodeFlag.VISIBLE),
        )
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot(nodes = listOf(duplicate, duplicate))))
        try {
            val result = pce.observe()
            val error = (result as PceResult.Err).error

            assertEquals(ErrorCode.INVALID_SNAPSHOT, error.code)
        } finally {
            pce.close()
        }
    }

    @Test
    fun rejectsMissingParent() = runBlocking {
        val orphan = RawNode(
            backendId = BackendNodeId("orphan"),
            parentBackendId = BackendNodeId("missing"),
            depth = 1,
            packageName = "com.example",
            className = "android.widget.TextView",
            viewId = null,
            text = "orphan",
            contentDescription = null,
            bounds = Bounds(0, 0, 10, 10),
            flags = setOf(NodeFlag.VISIBLE),
        )
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot(nodes = listOf(orphan))))
        try {
            val result = pce.observe()
            val error = (result as PceResult.Err).error

            assertEquals(ErrorCode.INVALID_SNAPSHOT, error.code)
        } finally {
            pce.close()
        }
    }

    @Test
    fun rejectsParentCycle() = runBlocking {
        fun node(id: String, parent: String) = RawNode(
            backendId = BackendNodeId(id),
            parentBackendId = BackendNodeId(parent),
            depth = 1,
            packageName = "com.example",
            className = "android.widget.TextView",
            viewId = null,
            text = id,
            contentDescription = null,
            bounds = Bounds(0, 0, 10, 10),
            flags = setOf(NodeFlag.VISIBLE),
        )
        val pce = Pce.create(
            FakeBackend(
                Fixtures.rawSnapshot(
                    nodes = listOf(node("a", "b"), node("b", "a")),
                    focused = null,
                )
            )
        )
        try {
            val result = pce.observe()
            val error = (result as PceResult.Err).error

            assertEquals(ErrorCode.INVALID_SNAPSHOT, error.code)
        } finally {
            pce.close()
        }
    }

    @Test
    fun rejectsMissingFocusedNode() = runBlocking {
        val pce = Pce.create(
            FakeBackend(Fixtures.rawSnapshot(focused = BackendNodeId("missing")))
        )
        try {
            val result = pce.observe()
            val error = (result as PceResult.Err).error

            assertEquals(ErrorCode.INVALID_SNAPSHOT, error.code)
        } finally {
            pce.close()
        }
    }

    @Test
    fun acceptsEmptySnapshot() = runBlocking {
        val pce = Pce.create(FakeBackend(Fixtures.rawSnapshot(nodes = emptyList(), focused = null)))
        try {
            val snapshot = pce.observe().getOrThrow()

            assertTrue(snapshot.nodes.isEmpty())
            assertTrue(snapshot.roots.isEmpty())
        } finally {
            pce.close()
        }
    }
}
