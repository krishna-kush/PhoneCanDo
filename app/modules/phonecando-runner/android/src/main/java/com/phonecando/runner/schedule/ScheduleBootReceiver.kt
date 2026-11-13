package com.phonecando.runner.schedule

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Arms the schedules' alarm again whenever Android may have dropped or
// moved it: a reboot (alarms do not survive one), an update of the app, a
// clock or zone change (a daily time moves with the zone), and "Alarms &
// reminders" granted (exact from now on). Separate from
// PackageReplacedReceiver, which brings the app back after a self-update.
// No start happens here: due tasks fire from the alarm this arms.
class ScheduleBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action !in ACTIONS) return
    val pending = goAsync()
    Schedules.get(context).rearm(timeMoved = action == Intent.ACTION_TIME_CHANGED || action == Intent.ACTION_TIMEZONE_CHANGED) {
      pending.finish()
    }
  }

  private companion object {
    val ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED,
    )
  }
}
