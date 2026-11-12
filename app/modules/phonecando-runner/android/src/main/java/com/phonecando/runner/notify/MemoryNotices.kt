package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import com.phonecando.runner.R
import com.phonecando.runner.memory.MemoryGuard

// The memory guard's one notification (id 4301, untagged like the engine
// service's and the update notice), on the agents' channel: the warning
// while memory is short, replaced by what we stopped to free some. The
// guard posts only while PhoneCanDo is not in front, once per stretch of
// low memory (later stops update it quietly). A tap opens the app on Home.
internal class MemoryNotices(private val context: Context) : MemoryGuard.Alerts {
  private var stoppedShown = false

  override fun warn(stopInMs: Long?) {
    stoppedShown = false
    post(MemoryLines.WARN_TITLE, MemoryLines.warn(stopInMs), quiet = false)
  }

  override fun stopped(names: List<String>) {
    post(MemoryLines.STOPPED_TITLE, MemoryLines.stopped(names), quiet = stoppedShown)
    stoppedShown = true
  }

  override fun clear() {
    stoppedShown = false
    manager()?.cancel(NOTIFICATION_ID)
  }

  private fun post(title: String, text: String, quiet: Boolean) {
    val nm = manager() ?: return
    AgentNotices.createChannel(nm)
    val notification = Notification.Builder(context, AgentNotices.CHANNEL)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setSmallIcon(R.drawable.ic_stat_phonecando)
      .setContentIntent(LaunchTargets.tap(context, LaunchTarget.of("home", null)))
      .setAutoCancel(true)
      .setOnlyAlertOnce(quiet)
      .build()
    try {
      nm.notify(NOTIFICATION_ID, notification)
    } catch (_: SecurityException) {
      // No POST_NOTIFICATIONS grant: nothing shows.
    }
  }

  private fun manager(): NotificationManager? = context.getSystemService(NotificationManager::class.java)

  companion object {
    const val NOTIFICATION_ID = 4301
  }
}
