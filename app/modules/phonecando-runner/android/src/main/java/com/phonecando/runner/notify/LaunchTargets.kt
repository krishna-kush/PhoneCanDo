package com.phonecando.runner.notify

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import com.phonecando.runner.PhoneCanDoRunnerModule
import com.phonecando.runner.PhoneCanDoServeService

// How a LaunchTarget reaches the app. `deliver` hands it to JS: the
// phonecandoLaunchTarget event when JS is attached, and the runner prefs
// for a cold start (consumeLaunchTarget reads and clears them once). Every
// notification tap and the bridge's own launch go through
// OpenTargetActivity with the target in the intent, so the target is bound
// when the app actually opens on it: two notifications for two agents each
// open their own agent, whichever was posted last.
internal object LaunchTargets {
  private const val TAG = "PhoneCanDoLaunch"
  private const val KEY_TAB = "launch_tab"
  private const val KEY_AGENT = "launch_agent"
  private const val EXTRA_TAB = "com.phonecando.runner.LAUNCH_TAB"
  private const val EXTRA_AGENT = "com.phonecando.runner.LAUNCH_AGENT"

  fun deliver(context: Context, target: LaunchTarget) {
    prefs(context).edit()
      .putString(KEY_TAB, target.tab)
      .putString(KEY_AGENT, target.agentId)
      .apply()
    PhoneCanDoRunnerModule.emitLaunchTarget(target.toMap())
  }

  /** The target waiting for the app, once; null when there is none. */
  fun consume(context: Context): LaunchTarget? {
    val prefs = prefs(context)
    val tab = prefs.getString(KEY_TAB, null) ?: return null
    val agentId = prefs.getString(KEY_AGENT, null)
    prefs.edit().remove(KEY_TAB).remove(KEY_AGENT).apply()
    return LaunchTarget.of(tab, agentId)
  }

  /** Opens PhoneCanDo on `target` (through OpenTargetActivity). */
  fun intent(context: Context, target: LaunchTarget): Intent =
    Intent(context, OpenTargetActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .putExtra(EXTRA_TAB, target.tab)
      .putExtra(EXTRA_AGENT, target.agentId)
      // Android tells PendingIntents apart by request code and
      // Intent.filterEquals, which ignores extras: with one shared intent the
      // last post would rewrite every earlier tap. The identifier is part of
      // filterEquals (API 29+, our minSdk), so each target gets a
      // PendingIntent of its own; two notices for the same target share
      // one, which opens the same place. No request-code bookkeeping.
      .setIdentifier(target.key)

  /** Starts PhoneCanDo on `target`; false when Android refused (background start). */
  fun open(context: Context, target: LaunchTarget): Boolean = try {
    context.startActivity(intent(context, target))
    true
  } catch (e: Exception) {
    Log.w(TAG, "open PhoneCanDo failed", e)
    false
  }

  /** A notification's tap: opens PhoneCanDo on `target`. */
  fun tap(context: Context, target: LaunchTarget): PendingIntent = PendingIntent.getActivity(
    context, 0, intent(context, target),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  fun fromIntent(intent: Intent): LaunchTarget? {
    val tab = intent.getStringExtra(EXTRA_TAB) ?: return null
    return LaunchTarget.of(tab, intent.getStringExtra(EXTRA_AGENT))
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
}
