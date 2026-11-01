package com.phonecando.pce.android

import android.accessibilityservice.AccessibilityService
import android.os.Process
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class TestAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile
        var instance: TestAccessibilityService? = null
    }

    override fun onCreate() {
        super.onCreate()
        Log.i("A11yDeviceTest", "service onCreate pid=${Process.myPid()}")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i("A11yDeviceTest", "service connected pid=${Process.myPid()}")
    }

    @Volatile
    var activityName: String? = null

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        val cls = event.className?.toString() ?: return
        if (cls.startsWith(pkg)) activityName = cls
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        if (instance === this) instance = null
        Log.i("A11yDeviceTest", "service onDestroy pid=${Process.myPid()}")
        super.onDestroy()
    }
}
