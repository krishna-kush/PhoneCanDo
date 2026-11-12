package com.phonecando.runner.power

import android.content.Context
import android.os.PowerManager
import android.util.Log

// Keeps the CPU awake while something of ours works and the screen may be
// off: a chat working, a model server reading a prompt, a model or Linux job
// (download, import, setup, install), or an agent's job doing something
// (engine/work/WorkMeter: a dev server waiting for requests is not). The
// foreground service keeps our process alive, but not the CPU: without this
// the phone sleeps under a running agent and it crawls. Never held for an
// idle agent. Each hold lasts TIMEOUT_MS and is renewed while needed (the
// service asks on every change and every work look), so a hold nobody
// renews ends by itself. Main thread only.
internal class WorkLock(context: Context) {
  private val lock = context.getSystemService(PowerManager::class.java)
    ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG_NAME)
    ?.apply { setReferenceCounted(false) }

  private var held = false

  /** Holds the CPU awake for TIMEOUT_MS from now when [need], else lets go. */
  fun hold(need: Boolean) {
    val lock = lock ?: return
    try {
      if (need) {
        lock.acquire(TIMEOUT_MS)
        if (!held) Log.i(TAG, "holding the CPU awake for work")
      } else if (lock.isHeld) {
        lock.release()
        Log.i(TAG, "letting the CPU sleep: no work")
      }
      held = need
    } catch (e: RuntimeException) {
      Log.w(TAG, "wake lock failed", e)
    }
  }

  fun release() = hold(false)

  private companion object {
    const val TAG = "PhoneCanDoPower"
    const val TAG_NAME = "PhoneCanDo:work"
    const val TIMEOUT_MS = 10 * 60_000L
  }
}
