package com.phonecando.pce.shizuku

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.BackendContract
import kotlinx.coroutines.runBlocking
import rikka.shizuku.Shizuku

class TestActivity : Activity() {
    private lateinit var result: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        result = TextView(this).apply {
            text = "idle"
            contentDescription = "pce-shizuku-result"
        }
        setContentView(result)
        if (intent.getBooleanExtra(EXTRA_RUN, false)) {
            result.postDelayed({ Thread { runScenario() }.start() }, 500)
        }
    }

    private fun runScenario() {
        try {
            val granted = isGranted()
            runBlocking {
                val shell = ShizukuShell()
                val backend = ShizukuBackend(shell)
                BackendContract.verify(backend)

                if (!granted) {
                    val unavailable = shell.run("echo pce-shizuku")
                    check(
                        unavailable is PceResult.Err &&
                            unavailable.error.code == ErrorCode.BACKEND_UNAVAILABLE,
                    ) { "unavailable shell returned $unavailable" }

                    val action = backend.execute(BackendAction.Key(KeyCode.BACK))
                    check(
                        action is PceResult.Err &&
                            action.error.code == ErrorCode.BACKEND_UNAVAILABLE,
                    ) { "unavailable backend returned $action" }
                } else {
                    val output = shell.run("echo pce-shizuku").getOrThrow()
                    check(output.stdout.trim() == "pce-shizuku") {
                        "granted shell returned $output"
                    }
                }

                val commands = mutableListOf<String>()
                val fake = ShizukuBackend(
                    ShellRunner { command ->
                        commands += command
                        PceResult.Ok(ShellOutput(0))
                    },
                )
                fake.execute(BackendAction.Key(KeyCode.BACK)).getOrThrow()
                fake.execute(BackendAction.Tap(point = Point(10, 20))).getOrThrow()
                fake.execute(
                    BackendAction.Swipe(Point(1, 2), Point(3, 4), durationMs = 300),
                ).getOrThrow()
                fake.execute(
                    BackendAction.Launch("com.example.app", ".MainActivity"),
                ).getOrThrow()
                check(
                    commands == listOf(
                        "input keyevent 4",
                        "input tap 10 20",
                        "input swipe 1 2 3 4 300",
                        "am start -n com.example.app/com.example.app.MainActivity",
                    ),
                ) { "fake commands were $commands" }

                val unsupported = fake.execute(
                    BackendAction.SetText(BackendNodeId("node"), "text", clear = false),
                )
                check(
                    unsupported is PceResult.Err &&
                        unsupported.error.code == ErrorCode.UNSUPPORTED_ACTION,
                ) { "unsupported action returned $unsupported" }
            }
            Log.i(
                TAG,
                if (granted) "PASS granted/contract/fake-input" else
                    "PASS unavailable/contract/fake-input",
            )
            show("PASS")
        } catch (failure: Throwable) {
            Log.e(TAG, "FAIL", failure)
            show("FAIL: ${failure.message}")
        }
    }

    private fun isGranted(): Boolean = try {
        Shizuku.pingBinder() &&
            Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    } catch (_: Exception) {
        false
    }

    private fun show(text: String) {
        runOnUiThread { result.text = text }
    }

    private companion object {
        const val TAG = "ShizukuDeviceTest"
        const val EXTRA_RUN = "run"
    }
}
