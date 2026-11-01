package com.phonecando.pce.shizuku

import com.phonecando.pce.api.Backend
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.Capability
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.RawSnapshot

/**
 * Privileged input backend over a [ShellRunner].
 *
 * This is a fallback for key events and coordinate gestures when accessibility
 * gestures are unavailable. It has no node identity and no observation: a tap
 * or long press must carry a [Point], and text belongs to the accessibility or
 * IME backend. The host supplies the real [ShizukuShell] and owns Shizuku
 * installation, permission and the provider declaration.
 */
class ShizukuBackend(
    private val shell: ShellRunner,
    override val id: String = "android-shizuku",
) : Backend {
    override val capabilities: Set<Capability> = setOf(
        Capability.TAP,
        Capability.LONG_PRESS,
        Capability.KEY,
        Capability.SWIPE,
        Capability.LAUNCH,
    )

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> =
        error(ErrorCode.UNSUPPORTED_ACTION, "The Shizuku backend cannot observe; use an observing backend")

    override suspend fun execute(action: BackendAction): PceResult<Unit> {
        val command = when (action) {
            is BackendAction.Tap -> {
                val point = action.point
                    ?: return error(
                        ErrorCode.UNSUPPORTED_ACTION,
                        "Tap needs a point; the Shizuku backend has no node identity",
                    )
                "input tap ${point.x} ${point.y}"
            }
            is BackendAction.LongPress -> {
                val point = action.point
                    ?: return error(
                        ErrorCode.UNSUPPORTED_ACTION,
                        "Long press needs a point; the Shizuku backend has no node identity",
                    )
                swipe(point, point, action.durationMs)
            }
            is BackendAction.Key -> "input keyevent ${action.key.androidKeyCode()}"
            is BackendAction.Swipe -> swipe(action.from, action.to, action.durationMs)
            is BackendAction.Launch -> launch(action)
                ?: return error(ErrorCode.INVALID_ACTION, "Launch has an invalid package or activity")
            is BackendAction.SetText -> return error(
                ErrorCode.UNSUPPORTED_ACTION,
                "Text is not supported by the Shizuku backend yet; use the accessibility or IME backend",
            )
            is BackendAction.Scroll -> return error(
                ErrorCode.UNSUPPORTED_ACTION,
                "Scroll needs a node or screen geometry; use the accessibility backend",
            )
            is BackendAction.Screenshot -> return error(
                ErrorCode.UNSUPPORTED_ACTION,
                "Screenshot has no artifact return path; use ObserveOptions(screenshot = true)",
            )
        }
        return when (val result = shell.run(command)) {
            is PceResult.Ok -> if (result.value.exitCode == 0) {
                PceResult.Ok(Unit)
            } else {
                shellFailure(result.value)
            }
            is PceResult.Err -> result
        }
    }

    private fun swipe(from: Point, to: Point, durationMs: Long): String =
        "input swipe ${from.x} ${from.y} ${to.x} ${to.y} ${durationMs.coerceAtLeast(1)}"

    private fun launch(action: BackendAction.Launch): String? {
        val packageName = action.packageName
        if (!PACKAGE.matches(packageName)) return null
        val activityName = action.activityName
        if (activityName == null) {
            return "monkey -p $packageName -c android.intent.category.LAUNCHER 1"
        }
        val activity = when {
            activityName.startsWith(".") -> packageName + activityName
            '.' !in activityName -> "$packageName.$activityName"
            else -> activityName
        }
        if (!ACTIVITY.matches(activity)) return null
        return "am start -n $packageName/$activity"
    }

    private fun shellFailure(output: ShellOutput): PceResult<Unit> {
        val detail = output.stderr.trim().ifEmpty { output.stdout.trim() }.take(500)
        val suffix = if (detail.isEmpty()) "" else ": $detail"
        return error(
            ErrorCode.INTERNAL,
            "Shizuku shell command failed (exit ${output.exitCode})$suffix",
        )
    }

    private fun KeyCode.androidKeyCode(): Int = when (this) {
        // Literal android.view.KeyEvent values keep this backend JVM-testable.
        KeyCode.ENTER -> 66
        KeyCode.BACK -> 4
        KeyCode.HOME -> 3
        KeyCode.RECENTS -> 187
        KeyCode.TAB -> 61
        KeyCode.ESCAPE -> 111
        KeyCode.UP -> 19
        KeyCode.DOWN -> 20
        KeyCode.LEFT -> 21
        KeyCode.RIGHT -> 22
        KeyCode.DELETE -> 67
    }

    private fun <T> error(code: ErrorCode, message: String): PceResult<T> =
        PceResult.Err(PceError(code, message))

    private companion object {
        val PACKAGE = Regex("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*")
        val ACTIVITY = Regex("[A-Za-z0-9_\$]+(?:\\.[A-Za-z0-9_\$]+)*")
    }
}
