package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context

// The foreground service's one notification: the chats the agents are busy
// with, one line each, the chat, then its agent, then its state
// (ChatBoard). Engines themselves never show. Chat titles stay off the lock
// screen: the public version only counts. Tapping opens the app; on that
// agent's Home when every chat listed belongs to one agent (or, with none,
// one engine runs).
internal class ServiceNotification(private val context: Context) {
  fun createChannel() {
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "PhoneCanDo agents", NotificationManager.IMPORTANCE_LOW),
    )
  }

  /** [names]: agent id → name; [running]: agents whose engine is live. */
  fun build(chats: List<ChatBoard.Chat>, names: Map<String, String>, running: List<String>): Notification {
    val agent = chats.map { it.agentId }.distinct().singleOrNull()
      ?: running.singleOrNull()?.takeIf { chats.isEmpty() }
    val tap = agent?.let { LaunchTargets.tap(context, LaunchTarget("home", it)) } ?: launchIntent()
    val summary = summary(chats)
    val builder = base(tap)
    when (chats.size) {
      0 -> builder.setContentTitle("PhoneCanDo").setContentText(NO_CHATS)
      1 -> {
        val chat = chats[0]
        builder.setContentTitle(title(chat)).setContentText("${name(chat, names)} · ${chat.state.label}")
      }
      else -> {
        val style = Notification.InboxStyle()
        chats.take(MAX_LINES).forEach { style.addLine("${title(it)} · ${name(it, names)} · ${it.state.label}") }
        if (chats.size > MAX_LINES) style.setSummaryText("+${chats.size - MAX_LINES} more")
        builder.setContentTitle("${chats.size} chats").setContentText(summary).setStyle(style)
      }
    }
    val public = base(tap).setContentTitle("PhoneCanDo").setContentText(summary.ifEmpty { NO_CHATS }).build()
    return builder.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public).build()
  }

  private fun base(tap: PendingIntent?): Notification.Builder =
    Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentIntent(tap)
      .setOngoing(true)

  private fun title(chat: ChatBoard.Chat) = chat.title ?: "New chat"

  private fun name(chat: ChatBoard.Chat, names: Map<String, String>) = names[chat.agentId] ?: chat.agentId

  // "1 waiting for your answer · 2 working", in the board's state order.
  private fun summary(chats: List<ChatBoard.Chat>): String =
    ChatBoard.State.entries.mapNotNull { state ->
      val n = chats.count { it.state == state }
      if (n == 0) null else "$n ${state.label.lowercase()}"
    }.joinToString(" · ")

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
    private const val NO_CHATS = "No chats running"

    // InboxStyle shows about five lines; the rest are counted.
    private const val MAX_LINES = 5
  }
}
