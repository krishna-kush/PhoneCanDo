package com.phonecando.pce.ime

import android.app.Activity
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import com.phonecando.pce.api.BackendAction
import com.phonecando.pce.api.BackendNodeId
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.KeyCode
import com.phonecando.pce.api.getOrThrow
import com.phonecando.pce.testkit.BackendContract
import kotlinx.coroutines.runBlocking

class TestActivity : Activity() {
    private lateinit var input: EditText
    private lateinit var result: TextView
    private var scenarioStarted = false

    @Volatile
    private var currentText = ""

    @Volatile
    private var resultText = "idle"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent.getBooleanExtra(EXTRA_RUN, false)) {
            window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }
        input = EditText(this).apply {
            contentDescription = "pce-ime-input"
            hint = "type here"
            imeOptions = EditorInfo.IME_ACTION_DONE
            setSingleLine(true)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(
                    s: CharSequence?,
                    start: Int,
                    count: Int,
                    after: Int,
                ) = Unit

                override fun onTextChanged(
                    s: CharSequence?,
                    start: Int,
                    before: Int,
                    count: Int,
                ) {
                    currentText = s?.toString().orEmpty()
                }

                override fun afterTextChanged(s: Editable?) = Unit
            })
            setOnKeyListener { _, keyCode, event ->
                if (keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN) {
                    resultText = "enter"
                    result.text = "enter"
                    true
                } else {
                    false
                }
            }
        }
        result = TextView(this).apply {
            text = "idle"
            contentDescription = "pce-ime-result"
        }
        root.addView(input)
        root.addView(result)
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
            window.decorView.postDelayed({
                input.requestFocus()
                getSystemService(InputMethodManager::class.java)
                    ?.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
                Thread { runScenario() }.start()
            }, 1_000)
        }
    }

    private fun runScenario() {
        val deadline = System.currentTimeMillis() + 15_000
        while (
            (TestImeService.instance == null ||
                TestImeService.instance?.currentInputConnection == null) &&
            System.currentTimeMillis() < deadline
        ) {
            Thread.sleep(50)
        }
        val service = TestImeService.instance
        if (service?.currentInputConnection == null) {
            fail(AssertionError("test IME did not provide an input connection"))
            return
        }

        val backend = ImeBackend(ImeServiceProvider { TestImeService.instance })
        try {
            runBlocking {
                BackendContract.verify(backend)

                val observe = backend.observe()
                check((observe as PceResult.Err).error.code == ErrorCode.UNSUPPORTED_ACTION) {
                    "observe returned $observe"
                }

                val unbound = ImeBackend(ImeServiceProvider { null })
                val unboundResult = unbound.execute(
                    BackendAction.SetText(BackendNodeId("ime"), "x", clear = false),
                )
                check((unboundResult as PceResult.Err).error.code == ErrorCode.BACKEND_UNAVAILABLE) {
                    "unbound execute returned $unboundResult"
                }

                backend.execute(
                    BackendAction.SetText(BackendNodeId("ime"), "old", clear = false),
                ).getOrThrow()
                awaitText("old")

                backend.execute(
                    BackendAction.SetText(BackendNodeId("ime"), "hello", clear = true),
                ).getOrThrow()
                awaitText("hello")

                backend.execute(BackendAction.Key(KeyCode.DELETE)).getOrThrow()
                awaitText("hell")

                backend.execute(BackendAction.Key(KeyCode.ENTER)).getOrThrow()
                awaitResult("enter")

                val unsupported = backend.execute(BackendAction.Key(KeyCode.BACK))
                check((unsupported as PceResult.Err).error.code == ErrorCode.UNSUPPORTED_ACTION) {
                    "unsupported key returned $unsupported"
                }
            }
            Log.i(TAG, "PASS set-text/clear/backspace/enter/unbound/contract")
            show("PASS")
        } catch (failure: Throwable) {
            fail(failure)
        }
    }

    private fun awaitText(expected: String) {
        val deadline = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < deadline) {
            if (currentText == expected) return
            Thread.sleep(50)
        }
        throw AssertionError("timed out waiting for text '$expected'; last='$currentText'")
    }

    private fun awaitResult(expected: String) {
        val deadline = System.currentTimeMillis() + 5_000
        while (System.currentTimeMillis() < deadline) {
            if (resultText == expected) return
            Thread.sleep(50)
        }
        throw AssertionError("timed out waiting for result '$expected'; last='$resultText'")
    }

    private fun fail(failure: Throwable) {
        Log.e(TAG, "FAIL", failure)
        show("FAIL: ${failure.message}")
    }

    private fun show(text: String) {
        runOnUiThread { result.text = text }
    }

    private companion object {
        const val TAG = "ImeDeviceTest"
        const val EXTRA_RUN = "run"
    }
}
