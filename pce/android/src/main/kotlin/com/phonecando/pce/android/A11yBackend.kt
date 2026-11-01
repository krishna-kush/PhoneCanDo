package com.phonecando.pce.android

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.app.KeyguardManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Path
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.Display
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.DeviceMeta
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.RawNode
import com.phonecando.pce.api.RawSnapshot
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.api.ScreenshotRef
import com.phonecando.pce.api.ScrollDirection
import com.phonecando.pce.api.Window
import com.phonecando.pce.api.WindowType
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/** Host owns the accessibility service; the PCE only needs a live handle. */
fun interface A11yServiceProvider {
    fun get(): AccessibilityService?
}

/**
 * Optional host metadata: the accessibility service tracks the last
 * `TYPE_WINDOW_STATE_CHANGED` event, because Android exposes no direct
 * "current activity" query to an accessibility service.
 */
fun interface A11yActivityNameProvider {
    fun activityName(packageName: String?): String?
}

/**
 * Clean-room accessibility backend. It observes the active window, assigns
 * path-based backend node ids and performs actions through the platform API.
 *
 * Screenshots are an observation option (`ObserveOptions.screenshot`) backed by
 * `takeScreenshot` on API 30+. The `SCREENSHOT` action capability is not
 * declared because `Backend.execute` cannot return an artifact yet.
 */
class A11yBackend @JvmOverloads constructor(
    private val serviceProvider: A11yServiceProvider,
    override val id: String = "android-a11y",
    private val activityNameProvider: A11yActivityNameProvider =
        A11yActivityNameProvider { _ -> null },
) : Backend {
    override val capabilities: Set<Capability> = setOf(
        Capability.OBSERVE,
        Capability.TAP,
        Capability.LONG_PRESS,
        Capability.SET_TEXT,
        Capability.KEY,
        Capability.SCROLL,
        Capability.SWIPE,
        Capability.LAUNCH,
    )

    @Volatile
    private var lastNodes: Map<BackendNodeId, AccessibilityNodeInfo> = emptyMap()

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> =
        withContext(Dispatchers.Main) {
            try {
                val service = serviceProvider.get()
                    ?: return@withContext error(ErrorCode.BACKEND_UNAVAILABLE, "Accessibility service is not connected")
                val root = service.rootInActiveWindow
                    ?: service.windows.firstNotNullOfOrNull { it.root }
                    ?: return@withContext error(ErrorCode.BACKEND_UNAVAILABLE, "No active accessibility window")
                val allWindows = service.windows
                val windows = if (options.includeWindows) allWindows.map { it.toWindow() } else emptyList()
                val traversal = Traversal(
                    includeInvisible = options.includeInvisible,
                    maxNodes = options.maxNodes.coerceAtLeast(1),
                )
                traversal.visit(root, parent = null, path = "0", depth = 0)
                lastNodes = traversal.nodes

                val screenshot = if (options.screenshot) {
                    when (val captured = captureScreenshot(service)) {
                        is PceResult.Ok -> captured.value
                        is PceResult.Err -> return@withContext captured
                    }
                } else {
                    null
                }

                val focused = traversal.rawNodes.firstOrNull {
                    NodeFlag.FOCUSED in it.flags && NodeFlag.EDITABLE in it.flags
                }?.backendId ?: traversal.rawNodes.firstOrNull {
                    NodeFlag.FOCUSED in it.flags
                }?.backendId

                val packageName = root.packageName?.toString()
                PceResult.Ok(
                    RawSnapshot(
                        backend = id,
                        packageName = packageName,
                        activityName = activityNameProvider.activityName(packageName),
                        windows = windows,
                        nodes = traversal.rawNodes,
                        focusedBackendNodeId = focused,
                        device = deviceMeta(
                            service = service,
                            imeVisible = allWindows.any {
                                it.type == AccessibilityWindowInfo.TYPE_INPUT_METHOD
                            },
                        ),
                        screenshot = screenshot,
                        // A11y traversal can race with the UI; stability is a P1 verifier concern.
                        stable = false,
                        truncated = traversal.truncated,
                    )
                )
            } catch (failure: Exception) {
                error(ErrorCode.INTERNAL, failure.message ?: "Accessibility observation failed")
            }
        }

    override suspend fun execute(action: BackendAction): PceResult<Unit> =
        withContext(Dispatchers.Main) {
            try {
                val service = serviceProvider.get()
                    ?: return@withContext error(ErrorCode.BACKEND_UNAVAILABLE, "Accessibility service is not connected")
                when (action) {
                    is BackendAction.Tap -> tap(service, action)
                    is BackendAction.LongPress -> longPress(service, action)
                    is BackendAction.SetText -> setText(action)
                    is BackendAction.Key -> key(service, action)
                    is BackendAction.Scroll -> scroll(service, action)
                    is BackendAction.Swipe -> gesture(service, action.from, action.to, action.durationMs)
                    is BackendAction.Launch -> launch(service, action)
                    is BackendAction.Screenshot -> error(
                        ErrorCode.UNSUPPORTED_ACTION,
                        "Use ObserveOptions(screenshot = true); the action has no artifact return path",
                    )
                }
            } catch (failure: Exception) {
                error(ErrorCode.INTERNAL, failure.message ?: "Accessibility action failed")
            }
        }

    override suspend fun close() {
        lastNodes = emptyMap()
    }

    private suspend fun tap(service: AccessibilityService, action: BackendAction.Tap): PceResult<Unit> {
        val node = action.backendNodeId?.let { lastNodes[it] }
        if (node != null) {
            // Gesture first: React Native nodes report clickable but often have
            // no ACTION_CLICK handler, so the accessibility click silently no-ops.
            val bounds = node.boundsOrNull()
            var gestureError: PceError? = null
            if (bounds != null) {
                when (val gestured = gesture(service, bounds.center, bounds.center, durationMs = 1)) {
                    is PceResult.Ok -> return gestured
                    is PceResult.Err -> gestureError = gestured.error
                }
            }
            if (node.isClickable && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return ok()
            }
            return gestureError?.let { PceResult.Err(it) }
                ?: error(ErrorCode.NOT_FOUND, "Node has no screen bounds")
        }
        val point = action.point
            ?: return error(ErrorCode.NOT_FOUND, "Tap needs a node or a point")
        return gesture(service, point, point, durationMs = 1)
    }

    private suspend fun longPress(
        service: AccessibilityService,
        action: BackendAction.LongPress,
    ): PceResult<Unit> {
        val node = action.backendNodeId?.let { lastNodes[it] }
        if (node != null) {
            if (node.isLongClickable && node.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)) {
                return ok()
            }
            val bounds = node.boundsOrNull()
                ?: return error(ErrorCode.NOT_FOUND, "Node has no screen bounds")
            return gesture(service, bounds.center, bounds.center, action.durationMs)
        }
        val point = action.point
            ?: return error(ErrorCode.NOT_FOUND, "Long press needs a node or a point")
        return gesture(service, point, point, action.durationMs)
    }

    private fun setText(action: BackendAction.SetText): PceResult<Unit> {
        val node = lastNodes[action.backendNodeId]
            ?: return error(ErrorCode.NOT_FOUND, "Node ${action.backendNodeId} is no longer available")
        if (!node.isEditable) {
            return error(ErrorCode.NOT_EDITABLE, "Node ${action.backendNodeId} is not editable")
        }
        val nextText = if (action.clear) {
            action.text
        } else {
            node.text?.toString().orEmpty() + action.text
        }
        val arguments = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, nextText)
        }
        return if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)) {
            ok()
        } else {
            error(ErrorCode.UNSUPPORTED_ACTION, "Node rejected ACTION_SET_TEXT")
        }
    }

    private fun key(service: AccessibilityService, action: BackendAction.Key): PceResult<Unit> {
        val globalAction = when (action.key) {
            com.phonecando.pce.api.KeyCode.BACK -> AccessibilityService.GLOBAL_ACTION_BACK
            com.phonecando.pce.api.KeyCode.HOME -> AccessibilityService.GLOBAL_ACTION_HOME
            com.phonecando.pce.api.KeyCode.RECENTS -> AccessibilityService.GLOBAL_ACTION_RECENTS
            else -> null
        }
        if (globalAction != null) {
            return if (service.performGlobalAction(globalAction)) {
                ok()
            } else {
                error(ErrorCode.UNSUPPORTED_ACTION, "Global action ${action.key} was rejected")
            }
        }
        if (action.key == com.phonecando.pce.api.KeyCode.ENTER) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                return error(ErrorCode.UNSUPPORTED_ACTION, "IME Enter needs Android 11+")
            }
            val focused = service.rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
                ?: return error(ErrorCode.NOT_FOUND, "No focused input node")
            return if (focused.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.id)) {
                ok()
            } else {
                error(ErrorCode.UNSUPPORTED_ACTION, "Focused node rejected IME Enter")
            }
        }
        return error(ErrorCode.UNSUPPORTED_ACTION, "Key ${action.key} is not supported by the accessibility backend")
    }

    private fun scroll(service: AccessibilityService, action: BackendAction.Scroll): PceResult<Unit> {
        val node = if (action.backendNodeId != null) {
            lastNodes[action.backendNodeId]
                ?: return error(ErrorCode.NOT_FOUND, "Node ${action.backendNodeId} is no longer available")
        } else {
            service.rootInActiveWindow?.findScrollable()
                ?: return error(ErrorCode.NOT_FOUND, "No scrollable node")
        }
        val scrollAction = when (action.direction) {
            ScrollDirection.UP -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            ScrollDirection.DOWN -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
            ScrollDirection.LEFT, ScrollDirection.RIGHT -> return error(
                ErrorCode.UNSUPPORTED_ACTION,
                "Horizontal scroll is not supported by the accessibility backend yet",
            )
        }
        return if (node.performAction(scrollAction)) {
            ok()
        } else {
            error(ErrorCode.UNSUPPORTED_ACTION, "Node rejected scroll ${action.direction}")
        }
    }

    private fun launch(service: AccessibilityService, action: BackendAction.Launch): PceResult<Unit> {
        val activityName = action.activityName
        val intent = if (activityName == null) {
            service.packageManager.getLaunchIntentForPackage(action.packageName)
        } else {
            val activity = when {
                activityName.startsWith(".") -> action.packageName + activityName
                '.' !in activityName -> "${action.packageName}.$activityName"
                else -> activityName
            }
            Intent().setComponent(ComponentName(action.packageName, activity))
        }
        if (intent == null) {
            return error(ErrorCode.NOT_FOUND, "No launchable activity for ${action.packageName}")
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            service.startActivity(intent)
            ok()
        } catch (failure: ActivityNotFoundException) {
            error(ErrorCode.NOT_FOUND, failure.message ?: "Activity not found")
        } catch (failure: SecurityException) {
            error(ErrorCode.BACKEND_UNAVAILABLE, failure.message ?: "Launch was denied")
        }
    }

    private suspend fun gesture(
        service: AccessibilityService,
        from: Point,
        to: Point,
        durationMs: Long,
    ): PceResult<Unit> = suspendCancellableCoroutine { continuation ->
        val path = Path().apply {
            moveTo(from.x.toFloat(), from.y.toFloat())
            lineTo(to.x.toFloat(), to.y.toFloat())
        }
        val stroke = GestureDescription.StrokeDescription(path, 0, durationMs.coerceAtLeast(1))
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        val dispatched = service.dispatchGesture(
            gesture,
            object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(gestureDescription: GestureDescription?) {
                    if (continuation.isActive) continuation.resume(ok())
                }

                override fun onCancelled(gestureDescription: GestureDescription?) {
                    if (continuation.isActive) {
                        continuation.resume(error(ErrorCode.CANCELLED, "Gesture was cancelled"))
                    }
                }
            },
            null,
        )
        if (!dispatched && continuation.isActive) {
            continuation.resume(error(ErrorCode.BACKEND_UNAVAILABLE, "Gesture dispatch failed"))
        }
    }

    @android.annotation.TargetApi(Build.VERSION_CODES.R)
    private suspend fun captureScreenshot(
        service: AccessibilityService,
    ): PceResult<ScreenshotRef> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return error(ErrorCode.UNSUPPORTED_ACTION, "Screenshot requires Android 11 (API 30)")
        }
        return suspendCancellableCoroutine { continuation ->
            service.takeScreenshot(
                Display.DEFAULT_DISPLAY,
                service.mainExecutor,
                object : AccessibilityService.TakeScreenshotCallback {
                    override fun onSuccess(screenshot: AccessibilityService.ScreenshotResult) {
                        val buffer = screenshot.hardwareBuffer
                        if (!continuation.isActive) {
                            buffer.close()
                            return
                        }
                        try {
                            val bitmap = Bitmap.wrapHardwareBuffer(buffer, screenshot.colorSpace)
                            val software = bitmap?.copy(Bitmap.Config.ARGB_8888, false)
                            if (software == null) {
                                continuation.resume(
                                    error(ErrorCode.INTERNAL, "Screenshot bitmap decode failed")
                                )
                                return
                            }
                            val dir = File(service.cacheDir, "pce-screenshots").apply { mkdirs() }
                            val file = File.createTempFile("snap-", ".jpg", dir)
                            FileOutputStream(file).use { output ->
                                if (!software.compress(Bitmap.CompressFormat.JPEG, 85, output)) {
                                    file.delete()
                                    continuation.resume(
                                        error(ErrorCode.INTERNAL, "Screenshot JPEG encode failed")
                                    )
                                    return
                                }
                            }
                            continuation.resume(
                                PceResult.Ok(
                                    ScreenshotRef(
                                        path = file.absolutePath,
                                        width = software.width,
                                        height = software.height,
                                        mimeType = "image/jpeg",
                                    )
                                )
                            )
                        } catch (failure: Throwable) {
                            continuation.resume(
                                error(
                                    ErrorCode.INTERNAL,
                                    failure.message ?: "Screenshot capture failed",
                                )
                            )
                        } finally {
                            buffer.close()
                        }
                    }

                    override fun onFailure(errorCode: Int) {
                        if (continuation.isActive) {
                            continuation.resume(
                                error(
                                    ErrorCode.UNSUPPORTED_ACTION,
                                    "takeScreenshot failed (code $errorCode)",
                                )
                            )
                        }
                    }
                },
            )
        }
    }

    private fun deviceMeta(service: AccessibilityService, imeVisible: Boolean): DeviceMeta {
        val metrics = service.resources.displayMetrics
        val powerManager = service.getSystemService(PowerManager::class.java)
        val keyguardManager = service.getSystemService(KeyguardManager::class.java)
        return DeviceMeta(
            sdk = Build.VERSION.SDK_INT,
            model = Build.MODEL,
            displayWidth = metrics.widthPixels,
            displayHeight = metrics.heightPixels,
            rotation = displayRotation(service),
            screenOn = powerManager?.isInteractive ?: true,
            keyguard = keyguardManager?.isKeyguardLocked ?: false,
            imeVisible = imeVisible,
        )
    }

    private fun displayRotation(service: AccessibilityService): Int {
        // A Service is not a display-associated Context on Android 16; use DisplayManager.
        val displayManager = service.getSystemService(DisplayManager::class.java)
        return displayManager?.getDisplay(Display.DEFAULT_DISPLAY)?.rotation ?: 0
    }

    private fun AccessibilityWindowInfo.toWindow(): Window {
        val rect = Rect()
        getBoundsInScreen(rect)
        return Window(
            id = id,
            type = when (type) {
                AccessibilityWindowInfo.TYPE_APPLICATION -> WindowType.APPLICATION
                AccessibilityWindowInfo.TYPE_INPUT_METHOD -> WindowType.INPUT_METHOD
                AccessibilityWindowInfo.TYPE_SYSTEM -> WindowType.SYSTEM
                AccessibilityWindowInfo.TYPE_ACCESSIBILITY_OVERLAY -> WindowType.ACCESSIBILITY_OVERLAY
                else -> WindowType.UNKNOWN
            },
            layer = layer,
            bounds = rect.toBounds(),
            active = isActive,
            focused = isFocused,
            packageName = root?.packageName?.toString(),
        )
    }

    private fun AccessibilityNodeInfo.boundsOrNull(): Bounds? {
        val rect = Rect()
        getBoundsInScreen(rect)
        return rect.toBounds().takeIf { it.isValid }
    }

    private fun Rect.toBounds() = Bounds(left, top, right, bottom)

    private fun AccessibilityNodeInfo.findScrollable(): AccessibilityNodeInfo? {
        if (isScrollable) return this
        for (index in 0 until childCount) {
            val child = getChild(index) ?: continue
            child.findScrollable()?.let { return it }
        }
        return null
    }

    @Suppress("DEPRECATION")
    private fun AccessibilityNodeInfo.toRaw(
        backendId: BackendNodeId,
        parentBackendId: BackendNodeId?,
        depth: Int,
    ): RawNode {
        val rect = Rect()
        getBoundsInScreen(rect)
        return RawNode(
            backendId = backendId,
            parentBackendId = parentBackendId,
            depth = depth,
            packageName = packageName?.toString(),
            className = className?.toString(),
            viewId = viewIdResourceName,
            text = text?.toString(),
            contentDescription = contentDescription?.toString(),
            bounds = rect.toBounds(),
            flags = buildSet {
                if (isClickable) add(NodeFlag.CLICKABLE)
                if (isLongClickable) add(NodeFlag.LONG_CLICKABLE)
                if (isScrollable) add(NodeFlag.SCROLLABLE)
                if (isEditable) add(NodeFlag.EDITABLE)
                if (isFocused) add(NodeFlag.FOCUSED)
                if (isSelected) add(NodeFlag.SELECTED)
                if (isEnabled) add(NodeFlag.ENABLED)
                if (isCheckable && isChecked) add(NodeFlag.CHECKED)
                if (isPassword) add(NodeFlag.PASSWORD)
                if (isVisibleToUser) add(NodeFlag.VISIBLE)
            },
        )
    }

    private inner class Traversal(
        private val includeInvisible: Boolean,
        private val maxNodes: Int,
    ) {
        val rawNodes = mutableListOf<RawNode>()
        val nodes = LinkedHashMap<BackendNodeId, AccessibilityNodeInfo>()
        var truncated = false

        fun visit(node: AccessibilityNodeInfo, parent: BackendNodeId?, path: String, depth: Int) {
            if (rawNodes.size >= maxNodes) {
                truncated = true
                return
            }
            val id = BackendNodeId(path)
            val include = includeInvisible || node.isVisibleToUser
            if (include) {
                nodes[id] = node
                rawNodes += node.toRaw(id, parent, depth)
            }
            for (index in 0 until node.childCount) {
                val child = node.getChild(index) ?: continue
                visit(
                    node = child,
                    parent = if (include) id else parent,
                    path = "$path/$index",
                    depth = if (include) depth + 1 else depth,
                )
            }
        }
    }

    private fun ok(): PceResult<Unit> = PceResult.Ok(Unit)

    private fun <T> error(code: ErrorCode, message: String): PceResult<T> =
        PceResult.Err(PceError(code, message, Recovery("observe")))
}
