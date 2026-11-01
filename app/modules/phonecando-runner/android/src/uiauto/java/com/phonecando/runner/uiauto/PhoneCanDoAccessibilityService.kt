package com.phonecando.runner.uiauto

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.phonecando.runner.PceAuto
import com.phonecando.runner.PceAutomation

// Full-build accessibility host. All observation and action logic lives in the
// PCE adapter; this service only owns the Android lifecycle.
class PhoneCanDoAccessibilityService : AccessibilityService() {
  private var pce: PceAutomation? = null

  // Android exposes no direct "current activity" query to an accessibility
  // service. Track the last window-state event; the PCE asks for it by
  // package so an IME/dialog event cannot leak into another app's snapshot.
  @Volatile private var activityPackage: String? = null
  @Volatile private var activityClass: String? = null

  // Monotonic accessibility-event counter. mobile_wait uses it to notice a
  // change that appeared and reverted between two snapshot polls.
  @Volatile var eventSeq: Long = 0L
    private set

  fun activityName(packageName: String?): String? {
    if (packageName.isNullOrEmpty() || activityPackage != packageName) return null
    return activityClass
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    try {
      val next = PceAutomationImpl(this)
      PceAuto.setService(next)
      pce = next
      Log.i(TAG, "pce adapter connected")
    } catch (t: Throwable) {
      Log.e(TAG, "pce adapter failed", t)
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    eventSeq++
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    val cls = event.className?.toString() ?: return
    // Generic root views and system dialogs are not activities.
    if (!cls.startsWith(pkg)) return
    activityPackage = pkg
    activityClass = cls
  }

  override fun onInterrupt() {
    Log.w(TAG, "accessibility service interrupted")
  }

  override fun onDestroy() {
    PceAuto.clear(pce)
    pce = null
    super.onDestroy()
  }

  private companion object {
    const val TAG = "PhoneCanDoUiAuto"
  }
}
