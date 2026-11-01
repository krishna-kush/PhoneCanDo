package com.phonecando.pce.android

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.phonecando.pce.api.Action
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.Point
import com.phonecando.pce.api.ResolvedNode
import com.phonecando.pce.api.ScrollDirection
import com.phonecando.pce.api.Selector
import com.phonecando.pce.api.Target
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.core.Pce
import com.phonecando.pce.testkit.BackendContract
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

class TestActivity : Activity() {
    private lateinit var result: TextView
    private var scenarioStarted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }
        val input = EditText(this).apply {
            contentDescription = "pce-input"
            hint = "type here"
        }
        val button = Button(this).apply {
            text = "pce-button"
            contentDescription = "pce-button"
        }
        val longButton = Button(this).apply {
            text = "pce-long"
            contentDescription = "pce-long"
        }
        result = TextView(this).apply {
            text = "idle"
            contentDescription = "pce-result"
        }
        button.setOnClickListener { result.text = "pce-tapped" }
        longButton.setOnLongClickListener {
            result.text = "pce-long-pressed"
            true
        }

        val scroll = ScrollView(this).apply {
            contentDescription = "pce-scroll"
        }
        val rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        repeat(100) { index ->
            rows.addView(TextView(this).apply { text = "row-$index" })
        }
        scroll.addView(rows)

        root.addView(input)
        root.addView(button)
        root.addView(longButton)
        root.addView(result)
        root.addView(
            scroll,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f,
            ),
        )
        setContentView(
            root,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )

    }

    override fun onResume() {
        super.onResume()
        if (!scenarioStarted && intent.getBooleanExtra(EXTRA_RUN, false)) {
            scenarioStarted = true
            window.decorView.postDelayed({ Thread { runScenario() }.start() }, 1_000)
        }
    }

    private fun runScenario() {
        val focusDeadline = System.currentTimeMillis() + 5_000
        while (!hasWindowFocus() && System.currentTimeMillis() < focusDeadline) {
            Thread.sleep(50)
        }

        val deadline = System.currentTimeMillis() + 10_000
        while (TestAccessibilityService.instance == null && System.currentTimeMillis() < deadline) {
            Thread.sleep(50)
        }
        val service = TestAccessibilityService.instance
        if (service == null) {
            fail(AssertionError("accessibility service did not connect"))
            return
        }
        val activityDeadline = System.currentTimeMillis() + 5_000
        while (TestAccessibilityService.instance?.activityName == null &&
            System.currentTimeMillis() < activityDeadline
        ) {
            Thread.sleep(50)
        }

        val backend = A11yBackend(
            serviceProvider = A11yServiceProvider { TestAccessibilityService.instance },
            activityNameProvider = A11yActivityNameProvider { pkg ->
                TestAccessibilityService.instance?.activityName?.takeIf {
                    pkg != null && it.startsWith(pkg)
                }
            },
        )
        val pce = Pce.create(backend)
        try {
            runBlocking {
                BackendContract.verify(backend)

                val initial = pce.observe().getOrThrow()
                check(initial.packageName?.contains("com.phonecando.pce.android") == true) {
                    "unexpected package ${initial.packageName}"
                }
                check(initial.activityName?.endsWith("TestActivity") == true) {
                    "unexpected activity ${initial.activityName}"
                }

                pce.act(
                    initial.id,
                    Action.Wait(Selector(contentDescription = "pce-button"), timeoutMs = 5_000),
                ).getOrThrow()

                val button = awaitNode(pce, Selector(contentDescription = "pce-button"))
                pce.act(
                    button.snapshotId,
                    Action.Tap(Target.Node(button.node.id)),
                ).getOrThrow()
                awaitNode(
                    pce,
                    Selector(contentDescription = "pce-result"),
                    expectedText = "pce-tapped",
                )

                val input = awaitNode(pce, Selector(contentDescription = "pce-input"))
                pce.act(
                    input.snapshotId,
                    Action.TypeText("hello", Target.Node(input.node.id), clear = true),
                ).getOrThrow()
                awaitNode(
                    pce,
                    Selector(contentDescription = "pce-input"),
                    expectedText = "hello",
                )

                val longButton = awaitNode(pce, Selector(contentDescription = "pce-long"))
                pce.act(
                    longButton.snapshotId,
                    Action.LongPress(Target.Node(longButton.node.id), durationMs = 700),
                ).getOrThrow()
                awaitNode(
                    pce,
                    Selector(contentDescription = "pce-result"),
                    expectedText = "pce-long-pressed",
                )

                val scroll = awaitNode(pce, Selector(contentDescription = "pce-scroll"))
                pce.act(
                    scroll.snapshotId,
                    Action.Scroll(
                        direction = ScrollDirection.DOWN,
                        target = Target.Node(scroll.node.id),
                        amount = 0.5f,
                    ),
                ).getOrThrow()

                val width = resources.displayMetrics.widthPixels
                val height = resources.displayMetrics.heightPixels
                pce.act(
                    scroll.snapshotId,
                    Action.Swipe(
                        from = Point(width / 2, height * 2 / 3),
                        to = Point(width / 2, height / 3),
                        durationMs = 300,
                    ),
                ).getOrThrow()

                val screenshotSnapshot = pce.observe(ObserveOptions(screenshot = true)).getOrThrow()
                val screenshot = screenshotSnapshot.screenshot
                    ?: error("screenshot observation returned no artifact")
                val screenshotFile = File(screenshot.path)
                check(screenshotFile.isFile && screenshotFile.length() > 0) {
                    "screenshot file missing or empty: ${screenshot.path}"
                }
                check(screenshot.width > 0 && screenshot.height > 0)
                check(screenshot.mimeType == "image/jpeg")
                Log.i(TAG, "screenshot=${screenshot.width}x${screenshot.height} path=${screenshot.path}")
                screenshotFile.delete()

                val rejected = pce.act(screenshotSnapshot.id, Action.Screenshot())
                check((rejected as PceResult.Err).error.code == ErrorCode.UNSUPPORTED_ACTION)

                // Change the screen, re-observe, then prove the old id is rejected.
                val stale = pce.observe().getOrThrow()
                val staleButton = pce.resolve(
                    stale.id,
                    Selector(contentDescription = "pce-button"),
                ).getOrThrow()
                pce.act(
                    stale.id,
                    Action.Tap(Target.Node(staleButton.node.id)),
                ).getOrThrow()
                val current = awaitNode(
                    pce,
                    Selector(contentDescription = "pce-result"),
                    expectedText = "pce-tapped",
                )

                val staleAct = pce.act(
                    stale.id,
                    Action.Wait(Selector(contentDescription = "pce-button"), timeoutMs = 100),
                )
                check((staleAct as PceResult.Err).error.code == ErrorCode.STALE_SNAPSHOT) {
                    "stale act returned $staleAct"
                }
                val staleResolve = pce.resolve(
                    stale.id,
                    Selector(contentDescription = "pce-button"),
                )
                check((staleResolve as PceResult.Err).error.code == ErrorCode.STALE_SNAPSHOT) {
                    "stale resolve returned $staleResolve"
                }

                pce.act(current.snapshotId, Action.Key(KeyCode.BACK)).getOrThrow()
            }
            Log.i(TAG, "PASS observe/wait/tap/type/long-press/scroll/swipe/screenshot/stale/back")
            show("PASS")
        } catch (failure: Throwable) {
            fail(failure)
        } finally {
            runBlocking { pce.close() }
        }
    }

    private suspend fun awaitNode(
        pce: Pce,
        selector: Selector,
        expectedText: String? = null,
    ): ResolvedNode {
        val deadline = System.currentTimeMillis() + 5_000
        var lastError: String? = null
        while (System.currentTimeMillis() < deadline) {
            when (val observed = pce.observe()) {
                is PceResult.Ok -> when (val resolved = pce.resolve(observed.value.id, selector)) {
                    is PceResult.Ok -> {
                        if (expectedText == null || resolved.value.node.text == expectedText) {
                            return resolved.value
                        }
                        lastError = "text=${resolved.value.node.text}"
                    }
                    is PceResult.Err -> lastError = resolved.error.message
                }
                is PceResult.Err -> lastError = observed.error.message
            }
            delay(100)
        }
        throw AssertionError("timed out waiting for $selector; last=$lastError")
    }

    private fun fail(failure: Throwable) {
        Log.e(TAG, "FAIL", failure)
        show("FAIL: ${failure.message}")
    }

    private fun show(text: String) {
        runOnUiThread { result.text = text }
    }

    private companion object {
        const val TAG = "A11yDeviceTest"
        const val EXTRA_RUN = "run"
    }
}
