package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import com.phonecando.runner.R
import com.phonecando.runner.engine.work.WorkWatch

// The foreground service's notifications, as ServicePlan lays them out:
// its own one, there while anything of ours runs ([summary]), heading a
// bundle of one notification per agent at work and per job ([item]), each
// with its own tap, bar and Stop buttons. Names and titles stay off the
// lock screen: each one's public version only counts or says what kind of
// thing it is.
internal class ServiceNotification(private val context: Context) {
  fun createChannel() {
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "PhoneCanDo agents", NotificationManager.IMPORTANCE_LOW),
    )
  }

  /** The service's own notification: the bundle's head, or the engines' ready line. */
  fun summary(summary: ServicePlan.Summary): Notification {
    val tap = summary.target?.let { LaunchTargets.tap(context, it) } ?: launchIntent()
    val public = base(tap).setContentTitle(TITLE).setContentText(summary.publicText).build()
    val builder = base(tap).setContentTitle(TITLE).setContentText(summary.text)
      .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public)
    if (summary.group) builder.setGroup(GROUP).setGroupSummary(true)
    return builder.build()
  }

  /**
   * One agent's or job's own notification in the bundle: [sortKey] keeps
   * the bundle in ServicePlan's order and [since] (when it first showed)
   * keeps it from jumping; [stop] and [stopJob] give its Stop buttons'
   * intents.
   */
  fun item(
    item: ServiceItem,
    sortKey: String,
    since: Long,
    stop: (String) -> PendingIntent?,
    stopJob: (String, WorkWatch.Job) -> PendingIntent?,
  ): Notification {
    val tap = item.target?.let { LaunchTargets.tap(context, it) } ?: launchIntent()
    val public = base(tap).setContentTitle(TITLE).setContentText(capital(item.publicText)).build()
    val builder = base(tap)
      .setGroup(GROUP)
      .setSortKey(sortKey)
      .setWhen(since)
      .setShowWhen(false)
      .setOnlyAlertOnce(true)
      .setContentTitle(item.title)
      .setContentText(capital(item.lines.firstOrNull().orEmpty()))
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setPublicVersion(public)
    if (item.lines.size > 1) {
      val style = Notification.InboxStyle()
      item.lines.take(MAX_LINES).forEach { style.addLine(capital(it)) }
      if (item.lines.size > MAX_LINES) style.setSummaryText("+${item.lines.size - MAX_LINES} more")
      builder.setStyle(style)
    }
    item.bar?.let { bar -> builder.setProgress(100, bar.percent ?: 0, bar.percent == null) }
    for (s in item.stops) {
      val intent = (if (s.job != null) stopJob(s.agentId, s.job) else stop(s.agentId)) ?: continue
      builder.addAction(Notification.Action.Builder(null, s.label, intent).build())
    }
    return builder.build()
  }

  /**
   * What startForeground shows when nothing runs (yet): Android wants one
   * for every start of the service, which then leaves the foreground at
   * once. Android 12 and later hold a new foreground service's
   * notification back for some seconds, so it is not seen.
   */
  fun quiet(): Notification = base(launchIntent()).setContentTitle(TITLE).build()

  /**
   * What the notification shows once nothing is left running, for the few
   * seconds the service stays before it goes ("opencode stopped"), in
   * place of the last lines and their Stop buttons.
   */
  fun done(text: String): Notification = base(launchIntent()).setContentTitle(TITLE).setContentText(text).build()

  private fun base(tap: PendingIntent?): Notification.Builder =
    Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_phonecando)
      .setContentIntent(tap)
      .setOngoing(true)

  // The lines are written lower case ("downloading 45%"); alone on a
  // notification, they start a sentence.
  private fun capital(text: String) = text.replaceFirstChar { it.uppercaseChar() }

  private fun launchIntent(): PendingIntent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(
        context, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

  companion object {
    const val CHANNEL_ID = "phonecando-engine"
    const val NOTIFICATION_ID = 4101

    // The items' one id; each is told apart by its tag (ServiceItems).
    const val ITEM_ID = 4103
    private const val TITLE = "PhoneCanDo"

    // The bundle the items and the service's own notification make.
    private const val GROUP = "com.phonecando.runner.SERVICE"

    // InboxStyle shows about five lines; the rest are counted.
    private const val MAX_LINES = 5
  }
}
