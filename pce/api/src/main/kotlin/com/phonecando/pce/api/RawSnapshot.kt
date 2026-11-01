package com.phonecando.pce.api

/**
 * Backend output before the core assigns dense [NodeId]s. Parent references
 * use [BackendNodeId] because only the backend knows its own node identity.
 */
data class RawNode(
    val backendId: BackendNodeId,
    val parentBackendId: BackendNodeId?,
    val depth: Int,
    val packageName: String?,
    val className: String?,
    val viewId: String?,
    val text: String?,
    val contentDescription: String?,
    val bounds: Bounds,
    val flags: Set<NodeFlag>,
)

/**
 * A backend-neutral capture. Nodes should be in breadth-first order; the core
 * does not depend on that for parent resolution, only for display order.
 */
data class RawSnapshot(
    val backend: String,
    val packageName: String?,
    val activityName: String?,
    val windows: List<Window>,
    val nodes: List<RawNode>,
    val focusedBackendNodeId: BackendNodeId?,
    val device: DeviceMeta,
    val screenshot: ScreenshotRef?,
    val stable: Boolean,
    val truncated: Boolean,
)
