package com.phonecando.runner.controllock

import android.content.Context
import android.os.SystemClock

// The process's one phone-control lock, shared by the bridge (who may
// drive) and the app (Settings, the unlock dialog). Made on first use,
// which reads the saved mode and unlock. Lite and play never check it:
// they have no phone control to lock.
object ControlLocks {
  /** How long an ask-mode unlock lasts without a phone-control call. */
  private const val ASK_IDLE_MS = 5 * 60_000L

  @Volatile
  private var lock: ControlLock? = null

  fun get(context: Context): ControlLock = lock ?: synchronized(this) {
    lock ?: ControlLock(
      KeystoreLockStore(context.applicationContext),
      AskGrants(ASK_IDLE_MS) { SystemClock.elapsedRealtime() },
    ).also { lock = it }
  }
}
