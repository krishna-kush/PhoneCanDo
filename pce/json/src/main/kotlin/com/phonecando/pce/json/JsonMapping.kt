package com.phonecando.pce.json

import com.phonecando.pce.api.Action
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.DeviceMeta
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Near
import com.phonecando.pce.api.Node
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.NodeId
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.ScreenshotRef
import com.phonecando.pce.api.ScrollDirection
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.SnapshotId
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.Window
import com.phonecando.pce.api.WindowType

internal fun Point.toDto() = PointDto(x, y)
internal fun PointDto.toApi() = Point(x, y)

internal fun Bounds.toDto() = BoundsDto(left, top, right, bottom)
internal fun BoundsDto.toApi() = Bounds(left, top, right, bottom)

internal fun Window.toDto() = WindowDto(
    id = id,
    type = type.name,
    layer = layer,
    bounds = bounds.toDto(),
    active = active,
    focused = focused,
    packageName = packageName,
)

internal fun WindowDto.toApi() = Window(
    id = id,
    type = WindowType.entries.firstOrNull { it.name == type } ?: WindowType.UNKNOWN,
    layer = layer,
    bounds = bounds.toApi(),
    active = active,
    focused = focused,
    packageName = packageName,
)

internal fun DeviceMeta.toDto() = DeviceDto(
    sdk = sdk,
    model = model,
    displayWidth = displayWidth,
    displayHeight = displayHeight,
    rotation = rotation,
    screenOn = screenOn,
    keyguard = keyguard,
    imeVisible = imeVisible,
)

internal fun DeviceDto.toApi() = DeviceMeta(
    sdk = sdk,
    model = model,
    displayWidth = displayWidth,
    displayHeight = displayHeight,
    rotation = rotation,
    screenOn = screenOn,
    keyguard = keyguard,
    imeVisible = imeVisible,
)

internal fun ScreenshotRef.toDto() = ScreenshotDto(path, width, height, mimeType, secure)
internal fun ScreenshotDto.toApi() = ScreenshotRef(path, width, height, mimeType, secure)

internal fun Node.toDto() = NodeDto(
    id = id.value,
    backendId = backendId?.value,
    parentId = parentId?.value,
    depth = depth,
    packageName = packageName,
    className = className,
    viewId = viewId,
    text = text,
    contentDescription = contentDescription,
    bounds = bounds.toDto(),
    flags = flags.map { it.name }.sorted(),
    childIds = childIds.map { it.value },
)

internal fun NodeDto.toApi() = Node(
    id = NodeId(id),
    backendId = backendId?.let(::BackendNodeId),
    parentId = parentId?.let(::NodeId),
    depth = depth,
    packageName = packageName,
    className = className,
    viewId = viewId,
    text = text,
    contentDescription = contentDescription,
    bounds = bounds.toApi(),
    flags = parseFlags(flags),
    childIds = childIds.map(::NodeId),
)

internal fun Snapshot.toDto() = SnapshotDto(
    id = id.value,
    capturedAtMs = capturedAtMs,
    backend = backend,
    packageName = packageName,
    activityName = activityName,
    windows = windows.map { it.toDto() },
    nodes = nodes.map { it.toDto() },
    focusedNodeId = focusedNodeId?.value,
    device = device.toDto(),
    screenshot = screenshot?.toDto(),
    stable = stable,
    truncated = truncated,
)

internal fun SnapshotDto.toApi() = Snapshot(
    id = SnapshotId(id),
    capturedAtMs = capturedAtMs,
    backend = backend,
    packageName = packageName,
    activityName = activityName,
    windows = windows.map { it.toApi() },
    nodes = nodes.map { it.toApi() },
    focusedNodeId = focusedNodeId?.let(::NodeId),
    device = device.toApi(),
    screenshot = screenshot?.toApi(),
    stable = stable,
    truncated = truncated,
)

internal fun Near.toDto() = NearDto(point.toDto(), radius)
internal fun NearDto.toApi() = Near(point.toApi(), radius)

internal fun Selector.toDto(): SelectorDto = SelectorDto(
    viewId = viewId,
    text = text,
    textContains = textContains,
    contentDescription = contentDescription,
    className = className,
    packageName = packageName,
    index = index,
    parent = parent?.toDto(),
    near = near?.toDto(),
    requiredFlags = requiredFlags.map { it.name }.sorted(),
    forbiddenFlags = forbiddenFlags.map { it.name }.sorted(),
)

internal fun SelectorDto.toApi(): Selector = Selector(
    viewId = viewId,
    text = text,
    textContains = textContains,
    contentDescription = contentDescription,
    className = className,
    packageName = packageName,
    index = index,
    parent = parent?.toApi(),
    near = near?.toApi(),
    requiredFlags = parseFlags(requiredFlags),
    forbiddenFlags = parseFlags(forbiddenFlags),
)

internal fun Target.toDto(): TargetDto = when (this) {
    is Target.Node -> TargetDto(type = "node", nodeId = id.value)
    is Target.BySelector -> TargetDto(type = "selector", selector = selector.toDto())
    is Target.Coordinates -> TargetDto(type = "coordinates", point = point.toDto())
}

internal fun TargetDto.toApi(): Target = when (type) {
    "node" -> Target.Node(NodeId(nodeId ?: error("target.nodeId is required")))
    "selector" -> Target.BySelector(selector?.toApi() ?: error("target.selector is required"))
    "coordinates" -> Target.Coordinates(point?.toApi() ?: error("target.point is required"))
    else -> error("unknown target type: $type")
}

internal fun Action.toDto(): ActionDto = when (this) {
    is Action.Tap -> ActionDto(type = "tap", target = target.toDto())
    is Action.LongPress -> ActionDto(
        type = "long_press",
        target = target.toDto(),
        durationMs = durationMs,
    )
    is Action.TypeText -> ActionDto(
        type = "type_text",
        text = text,
        target = target?.toDto(),
        clear = clear,
    )
    is Action.Key -> ActionDto(type = "key", key = key.name)
    is Action.Scroll -> ActionDto(
        type = "scroll",
        target = target?.toDto(),
        direction = direction.name,
        amount = amount,
    )
    is Action.Swipe -> ActionDto(
        type = "swipe",
        from = from.toDto(),
        to = to.toDto(),
        durationMs = durationMs,
    )
    is Action.Wait -> ActionDto(
        type = "wait",
        selector = selector.toDto(),
        timeoutMs = timeoutMs,
    )
    is Action.Assert -> ActionDto(type = "assert", selector = selector.toDto())
    is Action.Screenshot -> ActionDto(type = "screenshot", full = full)
    is Action.Launch -> ActionDto(
        type = "launch",
        packageName = packageName,
        activityName = activityName,
    )
}

internal fun ActionDto.toApi(): Action = when (type) {
    "tap" -> Action.Tap(requireTarget())
    "long_press" -> Action.LongPress(requireTarget(), durationMs ?: 600)
    "type_text" -> Action.TypeText(
        text = text ?: error("type_text.text is required"),
        target = target?.toApi(),
        clear = clear,
    )
    "key" -> Action.Key(parseEnum<KeyCode>(key, "key"))
    "scroll" -> Action.Scroll(
        direction = parseEnum<ScrollDirection>(direction, "direction"),
        target = target?.toApi(),
        amount = amount ?: 0.5f,
    )
    "swipe" -> Action.Swipe(
        from = requirePoint(from, "from"),
        to = requirePoint(to, "to"),
        durationMs = durationMs ?: 300,
    )
    "wait" -> Action.Wait(
        selector = requireSelector(),
        timeoutMs = timeoutMs ?: 5_000,
    )
    "assert" -> Action.Assert(requireSelector())
    "screenshot" -> Action.Screenshot(full)
    "launch" -> Action.Launch(
        packageName = packageName ?: error("launch.packageName is required"),
        activityName = activityName,
    )
    else -> error("unknown action type: $type")
}

internal fun PceError.toDto() = ErrorDto(
    code = code.name,
    message = message,
    recovery = recovery?.let { RecoveryDto(it.action, it.hint) },
    candidates = candidates.map { it.value },
)

internal fun ErrorDto.toApi() = PceError(
    code = com.phonecando.pce.api.ErrorCode.entries.firstOrNull { it.name == code }
        ?: com.phonecando.pce.api.ErrorCode.INTERNAL,
    message = message,
    recovery = recovery?.let { Recovery(it.action, it.hint) },
    candidates = candidates.map(::NodeId),
)

private fun parseFlags(values: List<String>): Set<NodeFlag> =
    values.mapNotNullTo(linkedSetOf()) { value ->
        NodeFlag.entries.firstOrNull { it.name == value }
    }

private inline fun <reified T : Enum<T>> parseEnum(value: String?, field: String): T {
    val name = value ?: error("$field is required")
    return enumValues<T>().firstOrNull { it.name == name }
        ?: error("unknown $field: $name")
}

private fun ActionDto.requireTarget(): Target =
    target?.toApi() ?: error("$type.target is required")

private fun ActionDto.requireSelector(): Selector =
    selector?.toApi() ?: error("$type.selector is required")

private fun requirePoint(point: PointDto?, field: String): Point =
    point?.toApi() ?: error("$field is required")
