package com.phonecando.runner

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

// Fires in the NEW build right after an APK replace (the installer killed the
// old process). It acts only on PhoneCanDo's own self-update: updates.ts sets
// a mark (markPending) right before it hands the APK to Android's installer,
// so dev reinstalls, adb installs and stale marks stay quiet, and the play
// channel, which Play updates, never acts. Android blocks background apps
// from opening a screen, so the direct launch only works where the OEM
// allows it; the notification is the path that always works. The installer's
// own "Open" button remains the first way back, and the app's start clears
// the notification (clearNotice).
class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    val channel = channelOf(context)
    if (channel == "play") return
    val from = consumeMark(context) ?: return
    // The user already came back through the installer's "Open" before this
    // broadcast arrived: nothing left to announce.
    if (isForeground(context)) return
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "PhoneCanDo updates", NotificationManager.IMPORTANCE_HIGH),
    )
    val pending = PendingIntent.getActivity(
      context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    // Only lite → full brings phone control; full → full is a plain update.
    val text = if (from == "lite" && channel == "full") {
      "Full build installed. Tap to open and switch on phone control."
    } else {
      "Update installed. Tap to open."
    }
    manager.notify(
      NOTIFICATION_ID,
      Notification.Builder(context, CHANNEL_ID)
        .setContentTitle("PhoneCanDo updated")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentIntent(pending)
        .setAutoCancel(true)
        .build(),
    )

    try {
      context.startActivity(launch)
      Log.i(TAG, "relaunch after update: started")
    } catch (e: Exception) {
      Log.i(TAG, "relaunch after update blocked: ${e.message}")
    }
  }

  companion object {
    private const val TAG = "phonecando-update"
    private const val CHANNEL_ID = "phonecando-updates"
    private const val NOTIFICATION_ID = 4202
    private const val KEY_MARK_AT = "self_update_at"
    private const val KEY_MARK_FROM = "self_update_from"
    // Covers a slow install and its Play Protect scan; an abandoned install
    // cannot claim a later, unrelated update.
    private const val MARK_TTL_MS = 30 * 60_000L

    // Called (markSelfUpdatePending) right before the installer screen, with
    // the channel of the build that starts the update. commit, not apply:
    // the install kills this process soon after.
    fun markPending(context: Context): Boolean =
      prefs(context).edit()
        .putLong(KEY_MARK_AT, System.currentTimeMillis())
        .putString(KEY_MARK_FROM, channelOf(context) ?: "")
        .commit()

    // App start (PhoneCanDoRunnerModule OnCreate): the user is back, so the
    // notification has done its job.
    fun clearNotice(context: Context) {
      try {
        context.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
      } catch (_: Exception) {
      }
    }

    // Reads and clears the mark. Returns the channel that started the update
    // when the mark is recent, else null.
    private fun consumeMark(context: Context): String? {
      val prefs = prefs(context)
      val at = prefs.getLong(KEY_MARK_AT, 0L)
      val from = prefs.getString(KEY_MARK_FROM, null) ?: ""
      prefs.edit().remove(KEY_MARK_AT).remove(KEY_MARK_FROM).apply()
      val age = System.currentTimeMillis() - at
      return if (at > 0L && age in 0..MARK_TTL_MS) from else null
    }

    private fun channelOf(context: Context): String? = try {
      context.packageManager.getApplicationInfo(
        context.packageName, android.content.pm.PackageManager.GET_META_DATA,
      ).metaData?.getString("com.phonecando.channel")
    } catch (_: Exception) {
      null
    }

    private fun isForeground(context: Context): Boolean {
      val am = context.getSystemService(ActivityManager::class.java) ?: return false
      val pid = android.os.Process.myPid()
      return am.runningAppProcesses?.any {
        it.pid == pid && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
      } == true
    }

    private fun prefs(context: Context) =
      context.getSharedPreferences(PhoneCanDoServeService.PREFS, Context.MODE_PRIVATE)
  }
}
