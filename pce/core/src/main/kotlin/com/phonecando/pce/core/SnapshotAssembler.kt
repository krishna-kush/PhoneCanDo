package com.phonecando.pce.core

import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.Node
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.SnapshotId

/**
 * Turns backend-owned ids into dense [NodeId]s and links the flat node list.
 * The backend remains the only owner of its own node identity.
 */
internal object SnapshotAssembler {
    fun assemble(
        raw: RawSnapshot,
        id: SnapshotId,
        capturedAtMs: Long,
    ): PceResult<Snapshot> {
        val backendToNode = LinkedHashMap<BackendNodeId, NodeId>(raw.nodes.size)
        raw.nodes.forEachIndexed { index, rawNode ->
            if (backendToNode.put(rawNode.backendId, NodeId(index)) != null) {
                return PceResult.Err(
                    PceError(
                        ErrorCode.INVALID_SNAPSHOT,
                        "Duplicate backend node id: ${rawNode.backendId.value}",
                    )
                )
            }
        }

        raw.nodes.forEach { rawNode ->
            val parent = rawNode.parentBackendId
            if (parent != null && parent !in backendToNode) {
                return PceResult.Err(
                    PceError(
                        ErrorCode.INVALID_SNAPSHOT,
                        "Node ${rawNode.backendId.value} references missing parent ${parent.value}",
                    )
                )
            }
        }

        val parentOf = raw.nodes.associate { it.backendId to it.parentBackendId }
        raw.nodes.forEach { start ->
            val seen = mutableSetOf<BackendNodeId>()
            var cursor: BackendNodeId? = start.backendId
            while (cursor != null) {
                if (!seen.add(cursor)) {
                    return PceResult.Err(
                        PceError(
                            ErrorCode.INVALID_SNAPSHOT,
                            "Parent cycle at ${cursor.value}",
                        )
                    )
                }
                cursor = parentOf[cursor]
            }
        }

        raw.focusedBackendNodeId?.let { focused ->
            if (focused !in backendToNode) {
                return PceResult.Err(
                    PceError(
                        ErrorCode.INVALID_SNAPSHOT,
                        "Focused node ${focused.value} is missing from the snapshot",
                    )
                )
            }
        }

        val nodes = raw.nodes.mapIndexed { index, rawNode ->
            Node(
                id = NodeId(index),
                backendId = rawNode.backendId,
                parentId = rawNode.parentBackendId?.let(backendToNode::get),
                depth = rawNode.depth,
                packageName = rawNode.packageName,
                className = rawNode.className,
                viewId = rawNode.viewId,
                text = rawNode.text,
                contentDescription = rawNode.contentDescription,
                bounds = rawNode.bounds,
                flags = rawNode.flags,
            )
        }

        val children = MutableList(nodes.size) { mutableListOf<NodeId>() }
        nodes.forEach { node ->
            node.parentId?.let { parent -> children[parent.value].add(node.id) }
        }
        val linked = nodes.mapIndexed { index, node ->
            node.copy(childIds = children[index].toList())
        }

        return PceResult.Ok(
            Snapshot(
                id = id,
                capturedAtMs = capturedAtMs,
                backend = raw.backend,
                packageName = raw.packageName,
                activityName = raw.activityName,
                windows = raw.windows,
                nodes = linked,
                focusedNodeId = raw.focusedBackendNodeId?.let(backendToNode::get),
                device = raw.device,
                screenshot = raw.screenshot,
                stable = raw.stable,
                truncated = raw.truncated,
            )
        )
    }
}
