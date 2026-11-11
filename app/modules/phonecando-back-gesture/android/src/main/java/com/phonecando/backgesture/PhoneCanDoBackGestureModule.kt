package com.phonecando.backgesture

import androidx.activity.BackEventCompat
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import expo.modules.kotlin.jni.worklets.Worklet
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android's back gesture as it happens, for the app's own pages and its
// drawer. While JS has one of those to go back from, this callback sits on
// top of React Native's and reports the swipe: its start, every move, a
// cancel and the commit, so the page can shrink under the thumb
// (predictive back, Android 14+). With a step worklet from JS, the start,
// every move and a cancel run it right here on the UI thread, so the page
// follows the thumb even while JS is busy; JS hears the start, the cancel
// and the commit. A back key, or an older Android, sends the commit alone.
// While JS has nothing of its own to go back from, the callback is off and
// React Native's BackHandler gets Back as before (the web UI's history,
// then leaving the app).
class PhoneCanDoBackGestureModule : Module() {
  private var callback: OnBackPressedCallback? = null
  private var owner: ComponentActivity? = null

  @Volatile
  private var wanted = false

  @Volatile
  private var step: Worklet? = null

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoBackGesture")
    Events(EVENT)

    Function("setEnabled") { enabled: Boolean ->
      wanted = enabled
      syncCallback()
    }

    Function("setStepWorklet") { worklet: Worklet? ->
      step = worklet
    }

    // A new activity (a restart, a config change) gets a callback of its own.
    OnActivityEntersForeground { syncCallback() }

    OnDestroy {
      // A JS reload makes a new module; this one's callback must not stay
      // on the activity and swallow Back for a JS that is gone.
      val activity = owner
      val cb = callback
      owner = null
      callback = null
      step = null
      activity?.runOnUiThread { cb?.remove() }
    }
  }

  private fun syncCallback() {
    val activity = appContext.currentActivity as? ComponentActivity ?: return
    activity.runOnUiThread { attach(activity).isEnabled = wanted }
  }

  // One callback per activity, added after React Native's (which it adds in
  // onCreate), so it is asked first while enabled. Tied to the activity's
  // lifecycle, it is re-added in the same order on every start.
  private fun attach(activity: ComponentActivity): OnBackPressedCallback {
    callback?.let { if (owner === activity) return it }
    callback?.remove()
    val cb = object : OnBackPressedCallback(false) {
      override fun handleOnBackStarted(backEvent: BackEventCompat) = emit("start", backEvent, runStep("start", backEvent))

      override fun handleOnBackProgressed(backEvent: BackEventCompat) {
        if (!runStep("progress", backEvent)) emit("progress", backEvent, false)
      }

      override fun handleOnBackCancelled() = emit("cancel", null, runStep("cancel", null))

      override fun handleOnBackPressed() = emit("commit", null, false)
    }
    activity.onBackPressedDispatcher.addCallback(activity, cb)
    owner = activity
    callback = cb
    return cb
  }

  // The back callbacks run on the main thread, where the UI runtime lives,
  // so the worklet runs at once. False: no worklet, or the runtime is not
  // installed yet; JS then gets the step as an event.
  private fun runStep(phase: String, event: BackEventCompat?): Boolean {
    val worklet = step ?: return false
    return try {
      worklet.execute(appContext.uiRuntime, phase, (event?.progress ?: 0f).toDouble(), edgeOf(event))
      true
    } catch (e: Throwable) {
      false
    }
  }

  private fun emit(phase: String, event: BackEventCompat?, handled: Boolean) {
    sendEvent(
      EVENT,
      mapOf(
        "phase" to phase,
        "progress" to (event?.progress ?: 0f).toDouble(),
        "edge" to edgeOf(event),
        "handled" to handled,
      ),
    )
  }

  private fun edgeOf(event: BackEventCompat?): String =
    when (event?.swipeEdge) {
      BackEventCompat.EDGE_LEFT -> "left"
      BackEventCompat.EDGE_RIGHT -> "right"
      else -> "none"
    }

  private companion object {
    const val EVENT = "phonecandoBackGesture"
  }
}
