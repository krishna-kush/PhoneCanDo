package com.phonecando.pce.consumer.core

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.DeviceMeta
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.RawNode
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.Window
import com.phonecando.pce.api.WindowType
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.core.Pce
import kotlinx.coroutines.runBlocking

/**
 * Core-only consumer: a tiny in-process backend proves that `pce-core`
 * resolves a selector and executes a typed action without any Android code.
 */
private class DemoBackend : Backend {
    override val id = "consumer-demo"
    override val capabilities = setOf(Capability.OBSERVE, Capability.TAP)

    private val snapshot = RawSnapshot(
        backend = id,
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
        nodes = listOf(
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
        ),
        focusedBackendNodeId = null,
        device = DeviceMeta(
            sdk = 36,
            model = "consumer-demo",
            displayWidth = 1080,
            displayHeight = 2400,
            rotation = 0,
            screenOn = true,
            keyguard = false,
            imeVisible = false,
        ),
        screenshot = null,
        stable = true,
        truncated = false,
    )

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> =
        PceResult.Ok(snapshot)

    override suspend fun execute(action: BackendAction): PceResult<Unit> {
        println("backend action=$action")
        return PceResult.Ok(Unit)
    }
}

fun main() = runBlocking {
    val pce = Pce.create(DemoBackend())
    try {
        val snapshot = pce.observe().getOrThrow()
        val add = pce.resolve(snapshot.id, Selector(text = "Add")).getOrThrow()
        val result = pce.act(snapshot.id, Action.Tap(Target.Node(add.node.id))).getOrThrow()
        println("core-only snapshot=${snapshot.id} node=${add.node.id} backend=${result.backend}")
    } finally {
        pce.close()
    }
}
