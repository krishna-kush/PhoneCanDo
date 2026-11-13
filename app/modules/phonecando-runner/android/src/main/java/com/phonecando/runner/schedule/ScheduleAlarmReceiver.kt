package com.phonecando.runner.schedule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Where the schedules' one alarm lands (ScheduleAlarms), in our process
// with no JS: it hands the firing to the scheduler's thread (Schedules.
// onAlarm) and keeps the broadcast open until that is done (goAsync), as
// everything that makes an agent work, a start, a restart or a wake, must
// happen while the alarm's leave to start the engine service from the
// background lasts.
class ScheduleAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION) return
    val pending = goAsync()
    Schedules.get(context).onAlarm { pending.finish() }
  }

  companion object {
    const val ACTION = "com.phonecando.runner.SCHEDULE_ALARM"
  }
}
