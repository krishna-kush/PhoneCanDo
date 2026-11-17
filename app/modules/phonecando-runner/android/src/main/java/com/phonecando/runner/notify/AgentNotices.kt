package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import com.phonecando.runner.R

// The notifications an agent is behind, on one channel: its own posts
// (/notify), its slot (the /app return notice and its engine alerts) and
// its prompts. Each is tagged with the agent's id, so one agent's
// notification never replaces another's whatever the ids, and its tap opens
// PhoneCanDo on that agent (LaunchTargets: the target rides in the tap).
// Ids within an agent: SLOT, /notify 4600-8695 (one per title), prompts
// 9000-9255, links to open (prompts/OpenUrlPrompts) 9300-9363, a due task
// 9400 (schedule/DueNotice), a capability that stopped working 9450-9465
// and a Check now waiting for you or its end 9466 (CheckNotices), a run cut
// off 9470 (cutoff/CutOffNotice), permission questions
// (prompts/PermissionPrompts) 9500-9563. The engine service (4101), the update
// notice (4202) and the memory notice (4301, MemoryNotices, on this
// channel) are untagged, so they never meet these. A notice may carry
// buttons (NoticeAction), each its own PendingIntent, and what a swipe
// away sends (deleteIntent).
internal class AgentNotices(private val context: Context) {
  data class Notice(
    val agentId: String,
    val id: Int,
    val title: String,
    val text: String,
    /** Shown beside the app name; the agent's name when the title is not. */
    val subText: String? = null,
    val tab: String = "home",
    /** Sound and vibration only when it is not already showing. */
    val quietUpdate: Boolean = false,
    val actions: List<NoticeAction> = emptyList(),
    /** Expanded, it shows the whole text (one too long for a line). */
    val longText: Boolean = false,
    /** Sent when you swipe it away (not when a tap or a button takes it down). */
    val deleteIntent: PendingIntent? = null,
    /** On Home, the tap opens this chat of the agent's (LaunchTarget.chatId). */
    val chatId: String? = null,
    /** The tap also runs this schedule now (schedule/DueNotice, LaunchTargets.runScheduleOf). */
    val runSchedule: String? = null,
  )

  /** A button on a notice; [needsUnlock]: on the lock screen it asks for the phone to be unlocked first (Android 12+). */
  data class NoticeAction(val label: String, val intent: PendingIntent, val needsUnlock: Boolean = false)

  /** Posts it; true when notifications show at all (no POST_NOTIFICATIONS grant posts nothing). */
  fun post(notice: Notice): Boolean {
    val nm = manager() ?: return false
    createChannel(nm)
    val builder = Notification.Builder(context, CHANNEL)
      .setContentTitle(notice.title)
      .setContentText(notice.text)
      .setSmallIcon(R.drawable.ic_stat_phonecando)
      .setContentIntent(LaunchTargets.tap(context, LaunchTarget.of(notice.tab, notice.agentId, notice.chatId), notice.runSchedule))
      .setAutoCancel(true)
      .setOnlyAlertOnce(notice.quietUpdate)
    notice.subText?.let(builder::setSubText)
    notice.deleteIntent?.let(builder::setDeleteIntent)
    if (notice.longText) builder.setStyle(Notification.BigTextStyle().bigText(notice.text))
    for (action in notice.actions) builder.addAction(button(action))
    nm.notify(notice.agentId, notice.id, builder.build())
    return runCatching { nm.areNotificationsEnabled() }.getOrDefault(false)
  }

  fun cancel(agentId: String, id: Int) {
    manager()?.cancel(agentId, id)
  }

  /** Cancels the agent's notice [id] only while it shows [text] (a shared slot may show another by now). */
  fun cancelShowing(agentId: String, id: Int, text: String) {
    val nm = manager() ?: return
    val shown = runCatching { nm.activeNotifications }.getOrNull() ?: return
    val match = shown.any { n ->
      n.tag == agentId && n.id == id && n.notification.extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() == text
    }
    if (match) nm.cancel(agentId, id)
  }

  /** Every notification an agent has up (it was deleted). */
  fun cancelAll(agentId: String) {
    val nm = manager() ?: return
    val shown = runCatching { nm.activeNotifications }.getOrNull() ?: return
    for (n in shown) if (n.tag == agentId) nm.cancel(n.tag, n.id)
  }

  private fun manager(): NotificationManager? = context.getSystemService(NotificationManager::class.java)

  private fun button(action: NoticeAction): Notification.Action {
    val b = Notification.Action.Builder(null, action.label, action.intent)
    if (action.needsUnlock && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) b.setAuthenticationRequired(true)
    return b.build()
  }

  companion object {
    const val CHANNEL = "phonecando-agent"

    fun createChannel(nm: NotificationManager) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "PhoneCanDo agent", NotificationManager.IMPORTANCE_DEFAULT))
    }

    /** The agent's one "come back to me" notice: the /app return notice and its alerts. */
    const val SLOT = 4500

    /** A Check now waiting for you, or that ended (CheckNotices): one per agent. */
    const val CHECK_RUN_ID = 9466

    private const val NOTIFY_BASE = 4600
    private const val PROMPT_BASE = 9000
    private const val PROMPT_SLOTS = 256
    private const val OPEN_URL_BASE = 9300
    private const val OPEN_URL_SLOTS = 64
    // 9400: a scheduled task that is due and needs you (schedule/DueNotice).
    private const val CHECK_BASE = 9450
    private const val CHECK_SLOTS = 16
    private const val PERMISSION_BASE = 9500
    private const val PERMISSION_SLOTS = 64

    /** /notify: one per agent and title, so a new status replaces the last. */
    fun notifyId(title: String) = NOTIFY_BASE + (title.hashCode() and 0xfff)

    fun promptId(seq: Int) = PROMPT_BASE + seq % PROMPT_SLOTS

    fun openUrlId(seq: Int) = OPEN_URL_BASE + seq % OPEN_URL_SLOTS

    /** A capability that stopped working: one per agent and capability ([slot] its place in the list). */
    fun checkId(slot: Int) = CHECK_BASE + slot % CHECK_SLOTS

    fun permissionId(seq: Int) = PERMISSION_BASE + seq % PERMISSION_SLOTS
  }
}
