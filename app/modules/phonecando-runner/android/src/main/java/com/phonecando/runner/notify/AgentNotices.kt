package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import com.phonecando.runner.R

// The notifications an agent is behind, on one channel: its own posts
// (/notify), its slot (the /app return notice and its engine alerts) and
// its prompts. Each is tagged with the agent's id, so one agent's
// notification never replaces another's whatever the ids, and its tap opens
// PhoneCanDo on that agent (LaunchTargets: the target rides in the tap).
// Ids within an agent: SLOT, /notify 4600-8695 (one per title), prompts
// 9000-9255, links to open (prompts/OpenUrlPrompts) 9300-9363. The engine
// service (4101), the update notice (4202) and the memory notice (4301,
// MemoryNotices, on this channel) are untagged, so they never meet these.
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
  )

  /** Posts it; true when notifications show at all (no POST_NOTIFICATIONS grant posts nothing). */
  fun post(notice: Notice): Boolean {
    val nm = manager() ?: return false
    createChannel(nm)
    val builder = Notification.Builder(context, CHANNEL)
      .setContentTitle(notice.title)
      .setContentText(notice.text)
      .setSmallIcon(R.drawable.ic_stat_phonecando)
      .setContentIntent(LaunchTargets.tap(context, LaunchTarget.of(notice.tab, notice.agentId)))
      .setAutoCancel(true)
      .setOnlyAlertOnce(notice.quietUpdate)
    notice.subText?.let(builder::setSubText)
    nm.notify(notice.agentId, notice.id, builder.build())
    return runCatching { nm.areNotificationsEnabled() }.getOrDefault(false)
  }

  fun cancel(agentId: String, id: Int) {
    manager()?.cancel(agentId, id)
  }

  /** Every notification an agent has up (it was deleted). */
  fun cancelAll(agentId: String) {
    val nm = manager() ?: return
    val shown = runCatching { nm.activeNotifications }.getOrNull() ?: return
    for (n in shown) if (n.tag == agentId) nm.cancel(n.tag, n.id)
  }

  private fun manager(): NotificationManager? = context.getSystemService(NotificationManager::class.java)

  companion object {
    const val CHANNEL = "phonecando-agent"

    fun createChannel(nm: NotificationManager) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "PhoneCanDo agent", NotificationManager.IMPORTANCE_DEFAULT))
    }

    /** The agent's one "come back to me" notice: the /app return notice and its alerts. */
    const val SLOT = 4500

    private const val NOTIFY_BASE = 4600
    private const val PROMPT_BASE = 9000
    private const val PROMPT_SLOTS = 256
    private const val OPEN_URL_BASE = 9300
    private const val OPEN_URL_SLOTS = 64

    /** /notify: one per agent and title, so a new status replaces the last. */
    fun notifyId(title: String) = NOTIFY_BASE + (title.hashCode() and 0xfff)

    fun promptId(seq: Int) = PROMPT_BASE + seq % PROMPT_SLOTS

    fun openUrlId(seq: Int) = OPEN_URL_BASE + seq % OPEN_URL_SLOTS
  }
}
