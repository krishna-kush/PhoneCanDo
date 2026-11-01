package com.phonecando.pce.shizuku

import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.ScrollDirection
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.BackendContract
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ShizukuBackendTest {
    private class RecordingShell(
        var result: PceResult<ShellOutput> = PceResult.Ok(ShellOutput(0)),
    ) : ShellRunner {
        val commands = mutableListOf<String>()

        override suspend fun run(command: String): PceResult<ShellOutput> {
            commands += command
            return result
        }
    }

    @Test
    fun `key commands use Android key codes`() = runBlocking {
        val shell = RecordingShell()
        val backend = ShizukuBackend(shell)
        val expected = mapOf(
            KeyCode.ENTER to 66,
            KeyCode.BACK to 4,
            KeyCode.HOME to 3,
            KeyCode.RECENTS to 187,
            KeyCode.TAB to 61,
            KeyCode.ESCAPE to 111,
            KeyCode.UP to 19,
            KeyCode.DOWN to 20,
            KeyCode.LEFT to 21,
            KeyCode.RIGHT to 22,
            KeyCode.DELETE to 67,
        )

        expected.forEach { (key, _) ->
            backend.execute(BackendAction.Key(key)).getOrThrow()
        }

        assertEquals(
            expected.values.map { "input keyevent $it" },
            shell.commands,
        )
    }

    @Test
    fun `coordinate gestures build input commands`() = runBlocking {
        val shell = RecordingShell()
        val backend = ShizukuBackend(shell)

        backend.execute(BackendAction.Tap(point = Point(10, 20))).getOrThrow()
        backend.execute(
            BackendAction.LongPress(point = Point(1, 2), durationMs = 0),
        ).getOrThrow()
        backend.execute(
            BackendAction.Swipe(Point(3, 4), Point(5, 6), durationMs = 0),
        ).getOrThrow()

        assertEquals(
            listOf(
                "input tap 10 20",
                "input swipe 1 2 1 2 1",
                "input swipe 3 4 5 6 1",
            ),
            shell.commands,
        )
    }

    @Test
    fun `node-only gestures are unsupported`() = runBlocking {
        val shell = RecordingShell()
        val backend = ShizukuBackend(shell)

        val tap = backend.execute(BackendAction.Tap(backendNodeId = BackendNodeId("node")))
        val longPress = backend.execute(
            BackendAction.LongPress(backendNodeId = BackendNodeId("node"), durationMs = 600),
        )

        assertEquals(ErrorCode.UNSUPPORTED_ACTION, errorCode(tap))
        assertEquals(ErrorCode.UNSUPPORTED_ACTION, errorCode(longPress))
        assertTrue(shell.commands.isEmpty())
    }

    @Test
    fun `launch normalizes activities and rejects shell metacharacters`() = runBlocking {
        val shell = RecordingShell()
        val backend = ShizukuBackend(shell)

        backend.execute(
            BackendAction.Launch("com.example.app", ".MainActivity"),
        ).getOrThrow()
        backend.execute(
            BackendAction.Launch("com.example.app", "MainActivity"),
        ).getOrThrow()
        backend.execute(
            BackendAction.Launch("com.example.app", "com.example.app.MainActivity"),
        ).getOrThrow()
        backend.execute(BackendAction.Launch("com.example.app")).getOrThrow()

        assertEquals(
            listOf(
                "am start -n com.example.app/com.example.app.MainActivity",
                "am start -n com.example.app/com.example.app.MainActivity",
                "am start -n com.example.app/com.example.app.MainActivity",
                "monkey -p com.example.app -c android.intent.category.LAUNCHER 1",
            ),
            shell.commands,
        )

        val invalidPackage = backend.execute(
            BackendAction.Launch("com.example.app;rm -rf /", ".MainActivity"),
        )
        val invalidActivity = backend.execute(
            BackendAction.Launch("com.example.app", ".Main;rm"),
        )
        assertEquals(ErrorCode.INVALID_ACTION, errorCode(invalidPackage))
        assertEquals(ErrorCode.INVALID_ACTION, errorCode(invalidActivity))
        assertEquals(4, shell.commands.size)
    }

    @Test
    fun `unsupported actions are rejected before the shell runs`() = runBlocking {
        val shell = RecordingShell()
        val backend = ShizukuBackend(shell)

        val setText = backend.execute(
            BackendAction.SetText(BackendNodeId("node"), "text", clear = false),
        )
        val scroll = backend.execute(
            BackendAction.Scroll(direction = ScrollDirection.DOWN, amount = 0.5f),
        )
        val screenshot = backend.execute(BackendAction.Screenshot())

        assertEquals(ErrorCode.UNSUPPORTED_ACTION, errorCode(setText))
        assertEquals(ErrorCode.UNSUPPORTED_ACTION, errorCode(scroll))
        assertEquals(ErrorCode.UNSUPPORTED_ACTION, errorCode(screenshot))
        assertTrue(shell.commands.isEmpty())
        assertEquals(ErrorCode.UNSUPPORTED_ACTION, errorCode(backend.observe()))
    }

    @Test
    fun `nonzero exit and shell errors are typed`() = runBlocking {
        val shell = RecordingShell(
            PceResult.Ok(ShellOutput(exitCode = 1, stderr = "denied")),
        )
        val backend = ShizukuBackend(shell)

        val failed = backend.execute(BackendAction.Key(KeyCode.BACK))
        assertEquals(ErrorCode.INTERNAL, errorCode(failed))
        assertTrue((failed as PceResult.Err).error.message.contains("denied"))

        shell.result = PceResult.Err(
            PceError(ErrorCode.BACKEND_UNAVAILABLE, "Shizuku is unavailable"),
        )
        val unavailable = backend.execute(BackendAction.Key(KeyCode.BACK))
        assertEquals(ErrorCode.BACKEND_UNAVAILABLE, errorCode(unavailable))
    }

    @Test
    fun `backend contract`() = runBlocking {
        BackendContract.verify(ShizukuBackend(RecordingShell()))
    }

    private fun errorCode(result: PceResult<*>): ErrorCode =
        (result as PceResult.Err).error.code
}
