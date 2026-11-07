package com.phonecando.runner.notify

import android.app.ActivityManager
import android.content.Context
import android.os.Process

// Whether PhoneCanDo is in front: our process at foreground importance, so
// one of our activities is on screen. The engine service alone keeps the
// process at foreground-service importance, which does not count.
internal object AppForeground {
  fun isForeground(context: Context): Boolean {
    val am = context.getSystemService(ActivityManager::class.java) ?: return false
    val pid = Process.myPid()
    return am.runningAppProcesses?.any {
      it.pid == pid && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    } == true
  }
}
