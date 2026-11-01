package com.phonecando.pce.testkit

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.ScrollDirection

/**
 * Backend-neutral contract checks. Call from a backend's own test suite:
 *
 *     BackendContract.verify(FakeBackend())
 *
 * The checks observe once and only execute actions for capabilities the
 * backend does not declare, so they do not mutate the screen under test.
 * A backend that declares [Capability.OBSERVE] must be usable when this runs.
 */
object BackendContract {
    suspend fun verify(backend: Backend) {
        contract(backend.id.isNotBlank()) { "backend id must not be blank" }

        val snapshot = if (Capability.OBSERVE in backend.capabilities) {
            observe(backend)
        } else {
            null
        }
        snapshot?.let { verifySnapshot(backend, it) }

        val nodeId = snapshot?.nodes?.firstOrNull()?.backendId
        if (Capability.TAP !in backend.capabilities) {
            expectUnsupported(backend, BackendAction.Tap(backendNodeId = nodeId))
        }
        if (Capability.LONG_PRESS !in backend.capabilities) {
            expectUnsupported(
                backend,
                BackendAction.LongPress(backendNodeId = nodeId, durationMs = 1),
            )
        }
        if (Capability.SET_TEXT !in backend.capabilities && nodeId != null) {
            expectUnsupported(backend, BackendAction.SetText(nodeId, "contract", clear = true))
        }
        if (Capability.KEY !in backend.capabilities) {
            expectUnsupported(backend, BackendAction.Key(KeyCode.BACK))
        }
        if (Capability.SCROLL !in backend.capabilities) {
            expectUnsupported(
                backend,
                BackendAction.Scroll(
                    backendNodeId = nodeId,
                    direction = ScrollDirection.DOWN,
                    amount = 0.5f,
                ),
            )
        }
        if (Capability.SWIPE !in backend.capabilities) {
            expectUnsupported(
                backend,
                BackendAction.Swipe(Point(0, 0), Point(1, 1), durationMs = 1),
            )
        }
        if (Capability.LAUNCH !in backend.capabilities) {
            expectUnsupported(backend, BackendAction.Launch("com.example.contract"))
        }
        if (Capability.SCREENSHOT !in backend.capabilities) {
            expectUnsupported(backend, BackendAction.Screenshot())
        }
    }

    private suspend fun observe(backend: Backend): RawSnapshot =
        when (val result = backend.observe()) {
            is PceResult.Ok -> result.value
            is PceResult.Err -> fail(
                "backend ${backend.id} observe returned ${result.error.code}: ${result.error.message}"
            )
        }

    private fun verifySnapshot(backend: Backend, snapshot: RawSnapshot) {
        contract(snapshot.backend == backend.id) {
            "snapshot.backend=${snapshot.backend} does not match backend.id=${backend.id}"
        }
        val ids = snapshot.nodes.map { it.backendId }
        contract(ids.size == ids.toSet().size) { "snapshot has duplicate backend node ids" }
        val known = ids.toSet()
        snapshot.nodes.forEach { node ->
            contract(node.bounds.isValid) {
                "node ${node.backendId} has invalid bounds ${node.bounds}"
            }
            contract(node.depth >= 0) {
                "node ${node.backendId} has negative depth ${node.depth}"
            }
            node.parentBackendId?.let { parent ->
                contract(parent in known) {
                    "node ${node.backendId} references missing parent $parent"
                }
            }
        }
        snapshot.focusedBackendNodeId?.let { focused ->
            contract(focused in known) { "focused node $focused is missing from the snapshot" }
        }
        contract(snapshot.device.displayWidth >= 0 && snapshot.device.displayHeight >= 0) {
            "device display size must not be negative"
        }
    }

    private suspend fun expectUnsupported(backend: Backend, action: BackendAction) {
        when (val result = backend.execute(action)) {
            is PceResult.Ok -> fail(
                "backend ${backend.id} executed $action without declaring its capability"
            )
            is PceResult.Err -> contract(result.error.code == ErrorCode.UNSUPPORTED_ACTION) {
                "backend ${backend.id} returned ${result.error.code} for undeclared $action; " +
                    "expected UNSUPPORTED_ACTION"
            }
        }
    }

    private fun contract(condition: Boolean, message: () -> String) {
        if (!condition) fail(message())
    }

    private fun fail(message: String): Nothing = throw AssertionError(message)
}
