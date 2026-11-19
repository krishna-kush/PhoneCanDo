package com.phonecando.runner.uiauto.overlay

import android.os.Handler
import android.os.Looper
import android.view.View
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

// Waits until each view's next frame went to the screen, then a little
// longer for the display to show it, so a change to the glass (see-through
// for a screenshot, touches let through) is on the screen before the agent
// acts. A window that draws nothing (just added, or gone) times out instead
// of holding the agent up.
internal object FrameWait {
  private val main = Handler(Looper.getMainLooper())

  suspend fun drawn(views: List<View>) {
    if (views.isEmpty()) return
    withTimeoutOrNull(TIMEOUT_MS) {
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

  private const val TIMEOUT_MS = 150L

  // About two frames at 60 Hz.
  private const val SHOWN_MS = 34L
}
