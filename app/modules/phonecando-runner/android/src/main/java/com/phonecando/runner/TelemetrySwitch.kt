package com.phonecando.runner

import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

// The user's telemetry on/off choice (the module's setTelemetryEnabled),
// kept in TelemetryStore's file as K_ENABLED (default on; no reset or
// consume clears it) and cached once read. Counting goes on either way, all
// of it local; what changes is the serve service, which opens the engine
// event stream just to count sessions only while this is on, and the engine
// stderr tail: turning sharing off drops it, and none is kept while it is off
// (TelemetryRecorder.engineDiedIn). Reads and writes hold the store's lock.
object TelemetrySwitch {
  private const val TAG = "PhoneCanDoTelemetry"

  // The on/off choice once read or set; null until then.
  @Volatile private var enabledCache: Boolean? = null
  private val enabledListeners = CopyOnWriteArrayList<(Boolean) -> Unit>()

  // Listeners hear a change, on the caller's thread.
  fun setEnabled(enabled: Boolean) {
    val changed = synchronized(TelemetryStore.lock) {
      val was = readEnabledLocked()
      enabledCache = enabled
      TelemetryStore.prefs()?.let { p ->
        try {
          val edit = p.edit().putBoolean(TelemetryStore.K_ENABLED, enabled)
          // Turning sharing off drops the kept engine log tail (see
          // TelemetryRecorder.engineDiedIn).
          if (!enabled) edit.remove(TelemetryStore.K_STDERR_TAIL)
          edit.apply()
        } catch (_: Throwable) {
        }
      }
      was != enabled
    }
    if (!changed) return
    for (listener in enabledListeners) {
      try {
        listener(enabled)
      } catch (t: Throwable) {
        Log.w(TAG, "telemetry listener failed", t)
      }
    }
  }

  /** The user's choice; true when it was never set or cannot be read. */
  fun isEnabled(): Boolean {
    enabledCache?.let { return it }
    return synchronized(TelemetryStore.lock) { readEnabledLocked() }
  }

  fun addEnabledListener(listener: (Boolean) -> Unit) {
    enabledListeners.addIfAbsent(listener)
  }

  fun removeEnabledListener(listener: (Boolean) -> Unit) {
    enabledListeners.remove(listener)
  }

  // Caches only a value actually read: an unavailable store (before the
  // first unlock) answers the default and is asked again next time.
  private fun readEnabledLocked(): Boolean {
    enabledCache?.let { return it }
    val p = TelemetryStore.prefs() ?: return true
    val value = try {
      p.getBoolean(TelemetryStore.K_ENABLED, true)
    } catch (_: Throwable) {
      true
    }
    enabledCache = value
    return value
  }
}
