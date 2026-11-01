package com.phonecando.pce.json

import kotlinx.serialization.Serializable

@Serializable
internal data class PointDto(val x: Int, val y: Int)

@Serializable
internal data class BoundsDto(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
)

@Serializable
internal data class WindowDto(
    val id: Int,
    val type: String,
    val layer: Int,
    val bounds: BoundsDto,
    val active: Boolean,
    val focused: Boolean,
    val packageName: String? = null,
)

@Serializable
internal data class DeviceDto(
    val sdk: Int,
    val model: String? = null,
    val displayWidth: Int,
    val displayHeight: Int,
    val rotation: Int,
    val screenOn: Boolean,
    val keyguard: Boolean,
    val imeVisible: Boolean,
)

@Serializable
internal data class ScreenshotDto(
    val path: String,
    val width: Int,
    val height: Int,
    val mimeType: String = "image/jpeg",
    val secure: Boolean = false,
)

@Serializable
internal data class NodeDto(
    val id: Int,
    val backendId: String? = null,
    val parentId: Int? = null,
    val depth: Int,
    val packageName: String? = null,
    val className: String? = null,
    val viewId: String? = null,
    val text: String? = null,
    val contentDescription: String? = null,
    val bounds: BoundsDto,
    val flags: List<String> = emptyList(),
    val childIds: List<Int> = emptyList(),
)

@Serializable
internal data class SnapshotDto(
    val id: Long,
    val capturedAtMs: Long,
    val backend: String,
    val packageName: String? = null,
    val activityName: String? = null,
    val windows: List<WindowDto> = emptyList(),
    val nodes: List<NodeDto> = emptyList(),
    val focusedNodeId: Int? = null,
    val device: DeviceDto,
    val screenshot: ScreenshotDto? = null,
    val stable: Boolean = true,
    val truncated: Boolean = false,
)

@Serializable
internal data class NearDto(val point: PointDto, val radius: Int)

@Serializable
internal data class SelectorDto(
    val viewId: String? = null,
    val text: String? = null,
    val textContains: String? = null,
    val contentDescription: String? = null,
    val className: String? = null,
    val packageName: String? = null,
    val index: Int? = null,
    val parent: SelectorDto? = null,
    val near: NearDto? = null,
    val requiredFlags: List<String> = emptyList(),
    val forbiddenFlags: List<String> = emptyList(),
)

@Serializable
internal data class TargetDto(
    val type: String,
    val nodeId: Int? = null,
    val selector: SelectorDto? = null,
    val point: PointDto? = null,
)

@Serializable
internal data class ActionDto(
    val type: String,
    val target: TargetDto? = null,
    val text: String? = null,
    val clear: Boolean = false,
    val key: String? = null,
    val direction: String? = null,
    val amount: Float? = null,
    val from: PointDto? = null,
    val to: PointDto? = null,
    val durationMs: Long? = null,
    val selector: SelectorDto? = null,
    val timeoutMs: Long? = null,
    val full: Boolean = false,
    val packageName: String? = null,
    val activityName: String? = null,
)

@Serializable
internal data class RecoveryDto(val action: String, val hint: String? = null)

@Serializable
internal data class ErrorDto(
    val code: String,
    val message: String,
    val recovery: RecoveryDto? = null,
    val candidates: List<Int> = emptyList(),
)
