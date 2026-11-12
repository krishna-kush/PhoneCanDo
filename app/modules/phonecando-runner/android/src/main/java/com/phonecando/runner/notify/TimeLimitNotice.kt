package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationManager
import android.content.Context

// What the engine service leaves behind when Android ends it at a
// foreground-service time limit (PhoneCanDoServeService.onTimeout): one
// notice on the agents' channel (id 4102, next to the service's 4101)
// saying the agents stopped and why. A tap opens the app on Home, which
// starts the active agent again.
internal object TimeLimitNotice {
  const val NOTIFICATION_ID = 4102
  const val TITLE = "Agents stopped"
  const val TEXT = "Android ended PhoneCanDo's time in the background. Open the app to start your agents again."

  fun post(context: Context) {
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    AgentNotices.createChannel(nm)
    val notification = Notification.Builder(context, AgentNotices.CHANNEL)
      .setContentTitle(TITLE)
      .setContentText(TEXT)
      .setStyle(Notification.BigTextStyle().bigText(TEXT))
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(LaunchTargets.tap(context, LaunchTarget.of("home", null)))
      .setAutoCancel(true)
      .build()
    try {
      nm.notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // No POST_NOTIFICATIONS grant: nothing shows.
    }
  }
}
