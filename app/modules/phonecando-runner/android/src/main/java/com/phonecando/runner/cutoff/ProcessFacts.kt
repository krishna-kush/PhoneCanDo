package com.phonecando.runner.cutoff

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.util.Log
import java.util.UUID

// What the look needs to know about this process and the last one: this
// process's id in the record, the phone's boot count (it moves on every
// boot) and how our last process ended (Android 11+).
internal object ProcessFacts {
  private const val TAG = "PhoneCanDoCutOff"

  /** This process's id in the record (CutOffRun.life): a run another process saw going was cut off with it. */
  val LIFE: String = UUID.randomUUID().toString().replace("-", "").take(16)

  fun bootCount(context: Context): Int? = try {
    Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1).takeIf { it >= 0 }
  } catch (e: Exception) {
    Log.w(TAG, "boot count not read", e)
    null
  }

  /** How our newest ended process ended: you stopped it (force stop, a swipe that ended it, the task manager), an update, else other. */
  fun lastExit(context: Context): CutOffLook.Exit {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return CutOffLook.Exit.UNKNOWN
    val info = try {
      context.getSystemService(ActivityManager::class.java)
        ?.getHistoricalProcessExitReasons(context.packageName, 0, 1)
        ?.firstOrNull()
    } catch (e: Exception) {
      Log.w(TAG, "last exit not read", e)
      null
    } ?: return CutOffLook.Exit.UNKNOWN
    return when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
        info.reason == ApplicationExitInfo.REASON_PACKAGE_UPDATED -> CutOffLook.Exit.UPDATED
      info.reason == ApplicationExitInfo.REASON_USER_REQUESTED ||
        info.reason == ApplicationExitInfo.REASON_USER_STOPPED -> CutOffLook.Exit.USER
      else -> CutOffLook.Exit.OTHER
    }
  }
}
