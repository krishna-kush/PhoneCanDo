package com.phonecando.pce.api

enum class WindowType {
    APPLICATION,
    INPUT_METHOD,
    SYSTEM,
    ACCESSIBILITY_OVERLAY,
    UNKNOWN,
}

data class Window(
    val id: Int,
    val type: WindowType,
    val layer: Int,
    val bounds: Bounds,
    val active: Boolean,
    val focused: Boolean,
    val packageName: String?,
)

/** Device facts a backend observed at capture time. */
data class DeviceMeta(
    val sdk: Int,
    val model: String?,
    val displayWidth: Int,
    val displayHeight: Int,
    val rotation: Int,
    val screenOn: Boolean,
    val keyguard: Boolean,
    val imeVisible: Boolean,
)

/** A screenshot artifact; the PCE never embeds image bytes in a snapshot. */
data class ScreenshotRef(
    val path: String,
    val width: Int,
    val height: Int,
    val mimeType: String = "image/jpeg",
    val secure: Boolean = false,
)

/**
 * Immutable, backend-neutral observation. Node ids are dense and ordered:
 * `nodes[i].id == NodeId(i)`. This invariant is what makes actions and traces
 * stable within one snapshot.
 */
data class Snapshot(
    val id: SnapshotId,
    val capturedAtMs: Long,
    val backend: String,
    val packageName: String?,
    val activityName: String?,
    val windows: List<Window>,
    val nodes: List<Node>,
    val focusedNodeId: NodeId?,
    val device: DeviceMeta,
    val screenshot: ScreenshotRef?,
    val stable: Boolean,
    val truncated: Boolean,
) {
    init {
        nodes.forEachIndexed { index, node ->
            require(node.id.value == index) {
                "snapshot nodes must be dense and ordered: expected NodeId($index), got ${node.id}"
            }
            node.parentId?.let { parent ->
                require(parent.value in nodes.indices) {
                    "snapshot node ${node.id} references missing parent $parent"
                }
            }
            node.childIds.forEach { child ->
                require(child.value in nodes.indices) {
                    "snapshot node ${node.id} references missing child $child"
                }
            }
        }
        focusedNodeId?.let { focused ->
            require(focused.value in nodes.indices) {
                "snapshot focused node $focused is missing"
            }
        }
        nodes.forEach { start ->
            val seen = mutableSetOf<NodeId>()
            var cursor: NodeId? = start.id
            while (cursor != null) {
                require(seen.add(cursor)) {
                    "snapshot node parent cycle at $cursor"
                }
                cursor = nodes[cursor.value].parentId
            }
        }
    }

    fun node(id: NodeId): Node? = nodes.getOrNull(id.value)?.takeIf { it.id == id }

    val roots: List<Node> get() = nodes.filter { it.parentId == null }
}
