package com.phonecando.runner.uiauto.overlay

import android.accessibilityservice.AccessibilityService
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.WindowManager.LayoutParams
import com.phonecando.runner.bridge.Bridge
import com.phonecando.runner.bridge.ScreenIndicator
import com.phonecando.runner.bridge.ScreenLease
import kotlin.concurrent.thread
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

// What you see while an agent drives the phone, over every app: the
// screen's edge lit (EdgeFrame) and a pill with the agent's face, its name
// and Take back (DrivingPill). Both are accessibility overlay windows of
// our service: they need no draw-over permission (SYSTEM_ALERT_WINDOW stays
// stripped), and Android lets touches through them to the app below, which
// it blocks for other apps' overlays (12+). The edge never takes a touch.
//
// The agent never meets it (GuardedBackend): a screenshot is taken with
// both windows see-through, and while one of its touches lands, the pill
// lets touches through too. Each waits for a drawn frame first, so the
// change is on the screen before the screenshot or touch.
//
// The bridge tells it who drives (ScreenIndicator, from DriverWatch);
// Take back goes to Bridge.takeBack. Window work runs on the main thread.
class DrivingOverlay(private val service: AccessibilityService) : ScreenIndicator, OverlayGuard {
  private val main = Handler(Looper.getMainLooper())
  private val windows = service.getSystemService(WindowManager::class.java)

  // Main thread only.
  private var frame: EdgeFrame? = null
  private var pill: DrivingPill? = null
  private var pillParams: LayoutParams? = null
  private var driver: ScreenLease.Seat? = null
  private var hides = 0
  private var throughs = 0

  override fun show(driver: ScreenLease.Seat?) {
    main.post { update(driver) }
  }

  /** The service is going: the windows go with it. */
  fun close() {
    main.post {
      driver = null
      removeNow()
    }
  }

  private fun update(next: ScreenLease.Seat?) {
    driver = next
    if (next == null) {
      // After Take back the pill says the phone is yours for a moment.
      if (pill?.returned == true) main.postDelayed({ if (driver == null) fadeOut() }, RETURNED_MS) else fadeOut()
      return
    }
    if (pill == null) add()
    pill?.bind(next.name)
  }

  private fun add() {
    val palette = Palette(service)
    val look = OverlayLook.current(service)
    val edge = EdgeFrame(service, palette, look.glow)
    val params = pillParams(look)
    val front = DrivingPill(service, palette, look, onTakeBack = ::takeBack, onSwitchLook = ::switchLook)
    try {
      windows.addView(edge, frameParams())
      windows.addView(front, params)
    } catch (e: Exception) {
      Log.w(TAG, "overlay failed", e)
      runCatching { windows.removeViewImmediate(edge) }
      return
    }
    frame = edge
    pill = front
    pillParams = params
    for (view in listOf(edge, front)) {
      view.alpha = 0f
      if (hides == 0) view.animate().alpha(1f).setDuration(FADE_MS).start()
    }
  }

  private fun fadeOut() {
    val gone = listOfNotNull(frame, pill)
    frame = null
    pill = null
    pillParams = null
    for (view in gone) {
      view.animate().alpha(0f).setDuration(FADE_MS).withEndAction { remove(view) }.start()
    }
  }

  private fun removeNow() {
    listOfNotNull(frame, pill).forEach(::remove)
    frame = null
    pill = null
    pillParams = null
  }

  private fun remove(view: View) {
    runCatching { windows.removeViewImmediate(view) }
  }

  private fun takeBack() {
    // Off the main thread: the line's notices may write the message log.
    thread(name = "phonecando-take-back") {
      if (!Bridge.takeBack()) show(null)
    }
  }

  // TEMP (OverlayLook): the next look, at once.
  private fun switchLook() {
    OverlayLook.next(service)
    val now = driver
    removeNow()
    if (now != null) update(now)
  }

  override suspend fun <T> hidden(block: suspend () -> T): T {
    val views = withContext(Dispatchers.Main) {
      hides++
      listOfNotNull(frame, pill).onEach {
        it.animate().cancel()
        it.alpha = 0f
      }
    }
    try {
      drawn(views)
      return block()
    } finally {
      withContext(NonCancellable + Dispatchers.Main) {
        if (--hides == 0) listOfNotNull(frame, pill).forEach { it.alpha = 1f }
      }
    }
  }

  override suspend fun <T> touchThrough(block: suspend () -> T): T {
    val view = withContext(Dispatchers.Main) {
      throughs++
      pill?.also { touchable(it, false) }
    }
    try {
      drawn(listOfNotNull(view))
      return block()
    } finally {
      withContext(NonCancellable + Dispatchers.Main) {
        if (--throughs == 0) pill?.let { touchable(it, true) }
      }
    }
  }

  private fun touchable(view: View, on: Boolean) {
    val params = pillParams ?: return
    params.flags = if (on) params.flags and LayoutParams.FLAG_NOT_TOUCHABLE.inv() else params.flags or LayoutParams.FLAG_NOT_TOUCHABLE
    runCatching { windows.updateViewLayout(view, params) }
  }

  // Waits until each view's next frame went to the screen, then a little
  // longer for the display to show it; a window that draws nothing (just
  // added, or gone) times out instead of holding the agent up.
  private suspend fun drawn(views: List<View>) {
    if (views.isEmpty()) return
    withTimeoutOrNull(DRAWN_TIMEOUT_MS) {
      for (view in views) {
        withContext(Dispatchers.Main) {
          suspendCancellableCoroutine { done ->
            val committed = Runnable { if (done.isActive) done.resume(Unit) }
            view.viewTreeObserver.registerFrameCommitCallback(committed)
            view.invalidate()
            done.invokeOnCancellation { main.post { view.viewTreeObserver.unregisterFrameCommitCallback(committed) } }
          }
        }
      }
    }
    delay(SHOWN_MS)
  }

  private fun frameParams() = LayoutParams(
    LayoutParams.MATCH_PARENT,
    LayoutParams.MATCH_PARENT,
    LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
    LayoutParams.FLAG_NOT_FOCUSABLE or LayoutParams.FLAG_NOT_TOUCHABLE or
      LayoutParams.FLAG_LAYOUT_IN_SCREEN or LayoutParams.FLAG_LAYOUT_NO_LIMITS,
    PixelFormat.TRANSLUCENT,
  ).apply {
    title = "PhoneCanDo driving edge"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      layoutInDisplayCutoutMode = LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      fitInsetsTypes = 0
    } else {
      layoutInDisplayCutoutMode = LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
  }

  // Inside the system bars, so the top look sits under the status bar and
  // the bottom one over the navigation bar.
  private fun pillParams(look: OverlayLook) = LayoutParams(
    LayoutParams.WRAP_CONTENT,
    LayoutParams.WRAP_CONTENT,
    LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
    LayoutParams.FLAG_NOT_FOCUSABLE or (if (throughs > 0) LayoutParams.FLAG_NOT_TOUCHABLE else 0),
    PixelFormat.TRANSLUCENT,
  ).apply {
    title = "PhoneCanDo driving pill"
    gravity = look.gravity
    val margin = (MARGIN_DP * service.resources.displayMetrics.density).toInt()
    x = margin
    y = margin
  }

  private companion object {
    const val TAG = "PhoneCanDoOverlay"
    const val FADE_MS = 200L
    const val RETURNED_MS = 1_500L
    const val MARGIN_DP = 10
    const val DRAWN_TIMEOUT_MS = 150L

    // About two frames at 60 Hz.
    const val SHOWN_MS = 34L
  }
}
