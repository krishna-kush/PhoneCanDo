package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import com.phonecando.runner.R

// The foreground service's one notification: the chats the agents are busy
// with, one line each, the chat, then its agent, then its state
// (ChatBoard), then the agents kept up by a job they left running or by
// Keep running (WorkLines, each with a Stop button for the first
// MAX_STOPS), then a model server reading a prompt (ReadingLines), then
// the model downloads and imports running (TransferLines), then the Linux
// jobs (LinuxJobLines). Engines themselves never show. Chat titles, jobs and
// model, system and agent names stay off the lock screen: the public
// version only counts. Tapping opens the app; on that
// agent's Home when every chat listed belongs to one agent (or, with none,
// one engine runs).
internal class ServiceNotification(private val context: Context) {
  fun createChannel() {
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "PhoneCanDo agents", NotificationManager.IMPORTANCE_LOW),
    )
  }

  /**
   * [names]: agent id → name; [running]: agents whose engine is live;
   * [transfers]: TransferLines of the model jobs; [reading]: the ReadingLines
   * line while a model server reads a prompt; [linuxJobs]: LinuxJobLines of
   * the Linux jobs; [work]: WorkLines of the agents kept up; [stop]: the
   * intent that stops one of those agents.
   */
  fun build(
    chats: List<ChatBoard.Chat>,
    names: Map<String, String>,
    running: List<String>,
    transfers: List<String> = emptyList(),
    reading: String? = null,
    linuxJobs: List<String> = emptyList(),
    work: List<WorkLines.Line> = emptyList(),
    stop: (String) -> PendingIntent? = { null },
  ): Notification {
    val agent = chats.map { it.agentId }.distinct().singleOrNull()
      ?: running.singleOrNull()?.takeIf { chats.isEmpty() }
    val tap = agent?.let { LaunchTargets.tap(context, LaunchTarget("home", it)) } ?: launchIntent()
    val counts = listOf(
      summary(chats), WorkLines.count(work), if (reading != null) READING else "", transferCount(transfers), linuxCount(linuxJobs),
    )
    val summary = counts.filter { it.isNotEmpty() }.joinToString(" · ")
    val extra = work.map { it.text } + listOfNotNull(reading) + transfers + linuxJobs
    val builder = base(tap)
    for (line in work.take(MAX_STOPS)) {
      val intent = stop(line.agentId) ?: continue
      builder.addAction(Notification.Action.Builder(null, "Stop ${line.name}", intent).build())
    }
    when {
      chats.isEmpty() && extra.size <= 1 ->
        builder.setContentTitle("PhoneCanDo").setContentText(extra.firstOrNull() ?: NO_CHATS)
      chats.size == 1 && extra.isEmpty() -> {
        val chat = chats[0]
        builder.setContentTitle(title(chat)).setContentText("${name(chat, names)} · ${chat.state.label}")
      }
      else -> {
        val lines = chats.map { "${title(it)} · ${name(it, names)} · ${it.state.label}" } + extra
        val style = Notification.InboxStyle()
        lines.take(MAX_LINES).forEach { style.addLine(it) }
        if (lines.size > MAX_LINES) style.setSummaryText("+${lines.size - MAX_LINES} more")
        val title = when (chats.size) {
          0 -> "PhoneCanDo"
          1 -> "1 chat"
          else -> "${chats.size} chats"
        }
        builder.setContentTitle(title).setContentText(summary).setStyle(style)
      }
    }
    val public = base(tap).setContentTitle("PhoneCanDo").setContentText(summary.ifEmpty { NO_CHATS }).build()
    return builder.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public).build()
  }

  // "2 models coming in": no names, so the lock screen may show it.
  private fun transferCount(transfers: List<String>): String = when (transfers.size) {
    0 -> ""
    1 -> "1 model coming in"
    else -> "${transfers.size} models coming in"
  }

  // "1 Linux job": no names either.
  private fun linuxCount(jobs: List<String>): String = when (jobs.size) {
    0 -> ""
    1 -> "1 Linux job"
    else -> "${jobs.size} Linux jobs"
  }

  private fun base(tap: PendingIntent?): Notification.Builder =
    Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_phonecando)
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

    // No model name, so the lock screen may show it.
    private const val READING = "reading the prompt"

    // InboxStyle shows about five lines; the rest are counted.
    private const val MAX_LINES = 5

    // Stop buttons for the agents kept up; Android shows three actions at most.
    private const val MAX_STOPS = 2
  }
}
