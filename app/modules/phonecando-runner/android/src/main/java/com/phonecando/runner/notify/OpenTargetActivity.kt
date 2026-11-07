package com.phonecando.runner.notify

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log

// What every agent notification and the bridge's own launch open: hands the
// intent's LaunchTarget to the app (LaunchTargets.deliver), starts
// PhoneCanDo and finishes in onCreate, so it never draws (Theme.NoDisplay,
// noHistory; manifest).
//
// Why a trampoline and not an Expo ReactActivityLifecycleListener reading
// MainActivity's intent: Android keeps the intent that created an activity
// and hands it back whenever it recreates that activity after the process
// died, e.g. on a later launcher tap. MainActivity passes a null saved state
// on to React, so a listener could not tell such a replay from a new tap and
// would switch agents again on its own. This activity reads each tap once,
// is never restored, and MainActivity only ever gets the plain launch
// intent. It also keeps the whole tap path inside this module: no Expo
// package scan, no change to the generated app.
class OpenTargetActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Recents can replay the intent that started a task; only a real tap or
    // launch carries a target.
    if (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY == 0) {
      LaunchTargets.fromIntent(intent)?.let { LaunchTargets.deliver(this, it) }
    }
    try {
      packageManager.getLaunchIntentForPackage(packageName)?.let(::startActivity)
    } catch (e: Exception) {
      Log.w(TAG, "open PhoneCanDo failed", e)
    }
    finish()
  }

  private companion object {
    const val TAG = "PhoneCanDoNotify"
  }
}
