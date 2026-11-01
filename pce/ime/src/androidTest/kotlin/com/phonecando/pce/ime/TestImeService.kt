package com.phonecando.pce.ime

import android.inputmethodservice.InputMethodService
import android.os.Process
import android.util.Log
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.TextView

class TestImeService : InputMethodService() {
    companion object {
        private const val TAG = "ImeDeviceTest"

        @Volatile
        var instance: TestImeService? = null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG, "service onCreate pid=${Process.myPid()}")
    }

    override fun onCreateInputView(): View =
        TextView(this).apply {
            text = "pce-ime"
            setPadding(24, 24, 24, 24)
        }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        Log.i(TAG, "onStartInput restarting=$restarting inputType=${attribute?.inputType}")
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        Log.i(TAG, "onStartInputView restarting=$restarting")
    }

    override fun onFinishInput() {
        Log.i(TAG, "onFinishInput")
        super.onFinishInput()
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        Log.i(TAG, "service onDestroy pid=${Process.myPid()}")
        super.onDestroy()
    }
}
