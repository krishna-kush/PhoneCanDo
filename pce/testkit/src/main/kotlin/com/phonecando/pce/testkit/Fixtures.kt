package com.phonecando.pce.testkit

import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.DeviceMeta
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.RawNode
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Window
import com.phonecando.pce.api.WindowType

/** Reusable snapshots for core tests, samples and backend contract tests. */
object Fixtures {
    fun rawSnapshot(
        nodes: List<RawNode> = defaultNodes(),
        focused: BackendNodeId? = BackendNodeId("search"),
        stable: Boolean = true,
    ): RawSnapshot = RawSnapshot(
        backend = "fake",
        packageName = "com.example",
        activityName = ".Main",
        windows = listOf(
            Window(
                id = 1,
                type = WindowType.APPLICATION,
                layer = 1,
                bounds = Bounds(0, 0, 1080, 2400),
                active = true,
                focused = true,
                packageName = "com.example",
            )
        ),
        nodes = nodes,
        focusedBackendNodeId = focused,
        device = DeviceMeta(
            sdk = 36,
            model = "test-device",
            displayWidth = 1080,
            displayHeight = 2400,
            rotation = 0,
            screenOn = true,
            keyguard = false,
            imeVisible = false,
        ),
        screenshot = null,
        stable = stable,
        truncated = false,
    )

    fun defaultNodes(): List<RawNode> = listOf(
        RawNode(
            backendId = BackendNodeId("root"),
            parentBackendId = null,
            depth = 0,
            packageName = "com.example",
            className = "android.widget.FrameLayout",
            viewId = "com.example:id/root",
            text = null,
            contentDescription = null,
            bounds = Bounds(0, 0, 1080, 2400),
            flags = setOf(NodeFlag.VISIBLE, NodeFlag.ENABLED),
        ),
        RawNode(
            backendId = BackendNodeId("search"),
            parentBackendId = BackendNodeId("root"),
            depth = 1,
            packageName = "com.example",
            className = "android.widget.EditText",
            viewId = "com.example:id/search",
            text = "Search",
            contentDescription = "Search field",
            bounds = Bounds(40, 210, 1040, 310),
            flags = setOf(
                NodeFlag.VISIBLE,
                NodeFlag.ENABLED,
                NodeFlag.EDITABLE,
                NodeFlag.FOCUSED,
                NodeFlag.CLICKABLE,
            ),
        ),
        RawNode(
            backendId = BackendNodeId("add"),
            parentBackendId = BackendNodeId("root"),
            depth = 1,
            packageName = "com.example",
            className = "android.widget.Button",
            viewId = "com.example:id/add",
            text = "Add",
            contentDescription = "Add item",
            bounds = Bounds(40, 400, 540, 500),
            flags = setOf(NodeFlag.VISIBLE, NodeFlag.ENABLED, NodeFlag.CLICKABLE),
        ),
        RawNode(
            backendId = BackendNodeId("add2"),
            parentBackendId = BackendNodeId("root"),
            depth = 1,
            packageName = "com.example",
            className = "android.widget.Button",
            viewId = "com.example:id/add2",
            text = "Add",
            contentDescription = "Add item",
            bounds = Bounds(560, 400, 1040, 500),
            flags = setOf(NodeFlag.VISIBLE, NodeFlag.ENABLED, NodeFlag.CLICKABLE),
        ),
    )
}
