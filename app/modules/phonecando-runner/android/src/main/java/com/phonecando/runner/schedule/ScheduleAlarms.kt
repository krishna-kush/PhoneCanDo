package com.phonecando.runner.schedule

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log

// The one alarm schedules use, at the soonest time the book needs
// (ScheduleBook.nextAlarm), re-armed after every change and firing; it goes
// to ScheduleAlarmReceiver in our process. Exact (setExactAndAllowWhileIdle)
// when you allowed "Alarms & reminders" (SCHEDULE_EXACT_ALARM; always on
// Android 11 and older): on time, and its broadcast may start the engine
// service from the background. Otherwise inexact (setAndAllowWhileIdle):
// Android may run it late, and its broadcast may not start the service, so
// a task that needs it asks you instead. Wall-clock times (RTC_WAKEUP).
internal class ScheduleAlarms(context: Context) {
  private val app = context.applicationContext ?: context
  private val manager: AlarmManager? = app.getSystemService(AlarmManager::class.java)

  /** Exact alarms are allowed. */
  fun exact(): Boolean {
    val am = manager ?: return false
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
  }

  /** The alarm at [at] (epoch ms; one in the past goes off at once); null cancels it. */
  fun arm(at: Long?) {
    val am = manager ?: return
    val tap = intent()
    if (at == null) {
      am.cancel(tap)
      return
    }
    try {
      if (exact()) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, tap)
      } else {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, tap)
      }
    } catch (e: SecurityException) {
      // The grant went between the check and the call.
      Log.w(TAG, "exact alarm refused; inexact instead", e)
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, tap)
    }
  }

  private fun intent(): PendingIntent = PendingIntent.getBroadcast(
    app,
    0,
    Intent(app, ScheduleAlarmReceiver::class.java).setAction(ScheduleAlarmReceiver.ACTION),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  companion object {
    private const val TAG = "PhoneCanDoSchedules"

    /** Opens Android's "Alarms & reminders" page for us; false where there is none (Android 11 and older) or it failed. */
    fun openSettings(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false
      return try {
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        true
      } catch (e: Exception) {
        Log.w(TAG, "alarm settings not opened", e)
        false
      }
    }
  }
}
