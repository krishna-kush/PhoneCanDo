package com.phonecando.pce.api

/** Semantic flags a backend can expose without leaking Android classes. */
enum class NodeFlag {
    CLICKABLE,
    LONG_CLICKABLE,
    SCROLLABLE,
    EDITABLE,
    FOCUSED,
    SELECTED,
    ENABLED,
    CHECKED,
    PASSWORD,
    VISIBLE,
}

/**
 * One accessibility node in a snapshot. Nodes are flat; tree shape is carried
 * by [parentId] and [childIds] so consumers can walk the tree or stream nodes
 * without a recursive type.
 */
data class Node(
    val id: NodeId,
    val backendId: BackendNodeId?,
    val parentId: NodeId?,
    val depth: Int,
    val packageName: String?,
    val className: String?,
    val viewId: String?,
    val text: String?,
    val contentDescription: String?,
    val bounds: Bounds,
    val flags: Set<NodeFlag>,
    val childIds: List<NodeId> = emptyList(),
) {
    val clickable: Boolean get() = NodeFlag.CLICKABLE in flags
    val editable: Boolean get() = NodeFlag.EDITABLE in flags
    val scrollable: Boolean get() = NodeFlag.SCROLLABLE in flags
    val visible: Boolean get() = NodeFlag.VISIBLE in flags
    val enabled: Boolean get() = NodeFlag.ENABLED in flags

    fun has(flag: NodeFlag): Boolean = flag in flags
}
