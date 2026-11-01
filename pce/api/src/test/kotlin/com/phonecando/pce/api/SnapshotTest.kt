package com.phonecando.pce.api

import kotlin.test.Test
import kotlin.test.assertFailsWith

class SnapshotTest {
    @Test
    fun rejectsParentCycle() {
        assertFailsWith<IllegalArgumentException> {
            snapshot(
                nodes = listOf(
                    node(NodeId(0), parent = NodeId(1)),
                    node(NodeId(1), parent = NodeId(0)),
                ),
            )
        }
    }

    @Test
    fun rejectsMissingFocusedNode() {
        assertFailsWith<IllegalArgumentException> {
            snapshot(
                nodes = listOf(node(NodeId(0), parent = null)),
                focused = NodeId(1),
            )
        }
    }

    private fun snapshot(
        nodes: List<Node>,
        focused: NodeId? = null,
    ) = Snapshot(
        id = SnapshotId(1),
        capturedAtMs = 0,
        backend = "test",
        packageName = null,
        activityName = null,
        windows = emptyList(),
        nodes = nodes,
        focusedNodeId = focused,
        device = DeviceMeta(
            sdk = 0,
            model = null,
            displayWidth = 0,
            displayHeight = 0,
            rotation = 0,
            screenOn = true,
            keyguard = false,
            imeVisible = false,
        ),
        screenshot = null,
        stable = true,
        truncated = false,
    )

    private fun node(id: NodeId, parent: NodeId?) = Node(
        id = id,
        backendId = BackendNodeId(id.value.toString()),
        parentId = parent,
        depth = 0,
        packageName = null,
        className = null,
        viewId = null,
        text = null,
        contentDescription = null,
        bounds = Bounds(0, 0, 1, 1),
        flags = emptySet(),
    )
}
