package com.phonecando.runner.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import com.phonecando.runner.R
import com.phonecando.runner.engine.work.WorkWatch

// The foreground service's one notification, there while anything of ours
// runs: the chats the agents are busy with, one line each, the chat,
// then its agent, then its state (ChatBoard), then the agents stopping
// (under a running progress bar), then the agents kept up by a
// job they left running or are starting, by Keep running or at work
// unseen (WorkLines; Stop buttons for each job alone and for the agent
// with all of it, MAX_ACTIONS at most, as Android shows no more),
// then the agents starting, then a model server reading a prompt
// (ReadingLines), then the model downloads and imports running
// (TransferLines), then the Linux jobs (LinuxJobLines), then PhoneCanDo's
// own update download (TransferLines too). Engines that only
// run get one quiet line with no buttons (ReadyLines): away from the app,
// Android stops a service out of the foreground about a minute later, and
// the agents with it. With the app on screen that line is not needed, so
// there is none: the app shows its agents. Only then, or with nothing
// running at all, is there no notification (build gives null) and the
// service leaves the foreground.
// Chat titles, jobs and model, system and agent names stay off the lock
// screen: the public version only counts. Tapping opens the app; on that
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
   * the Linux jobs; [work]: WorkLines of the agents kept up; [starting]: the
   * names of the agents whose engines start; [stop]: the intent that stops
   * one of those agents; [stopping]: the ids of the agents a Stop was asked
   * of whose engines still run, each a "Stopping …" line in place of its
   * job's, with no Stop button, under a running progress bar, so a stop
   * that takes a few seconds never looks hung; [stopJob]: the intent that
   * stops one job alone; [endingJobs]: the names of the jobs being
   * stopped, a "Stopping …" line each under the same bar; [update]: the
   * TransferLines line of the update download. With none of
   * that, the agents in [running] as ready, unless [onScreen] (the app is
   * in front); null when nothing runs.
   */
  fun build(
    chats: List<ChatBoard.Chat>,
    names: Map<String, String>,
    running: List<String>,
    transfers: List<String> = emptyList(),
    reading: String? = null,
    linuxJobs: List<String> = emptyList(),
    work: List<WorkLines.Line> = emptyList(),
    starting: List<String> = emptyList(),
    stop: (String) -> PendingIntent? = { null },
    stopping: Collection<String> = emptyList(),
    stopJob: (String, WorkWatch.Job) -> PendingIntent? = { _, _ -> null },
    endingJobs: List<String> = emptyList(),
    onScreen: Boolean = false,
    update: String? = null,
  ): Notification? {
    val kept = work.filter { it.agentId !in stopping }
    val ending = stopping.map { "Stopping ${names[it] ?: it}…" } + endingJobs.map { "Stopping $it…" }
    val extra = ending + kept.map { it.text } + starting.map { "Starting $it" } + listOfNotNull(reading) + transfers + linuxJobs + listOfNotNull(update)
    if (chats.isEmpty() && extra.isEmpty() && running.isEmpty()) return null
    val agent = chats.map { it.agentId }.distinct().singleOrNull()
      ?: running.singleOrNull()?.takeIf { chats.isEmpty() }
    val tap = agent?.let { LaunchTargets.tap(context, LaunchTarget("home", it)) } ?: launchIntent()
    if (chats.isEmpty() && extra.isEmpty()) return if (onScreen) null else ready(running.map { names[it] ?: it }, tap)
    val counts = listOf(
      summary(chats), stoppingCount(ending), WorkLines.count(kept), startingCount(starting),
      if (reading != null) READING else "", transferCount(transfers), linuxCount(linuxJobs),
      if (update != null) UPDATE else "",
    )
    val summary = counts.filter { it.isNotEmpty() }.joinToString(" · ")
    val builder = base(tap)
    if (ending.isNotEmpty()) builder.setProgress(0, 0, true)
    for ((label, intent) in stops(kept, stop, stopJob).take(MAX_ACTIONS)) {
      builder.addAction(Notification.Action.Builder(null, label, intent).build())
    }
    when {
      chats.isEmpty() && extra.size == 1 -> builder.setContentTitle("PhoneCanDo").setContentText(extra[0])
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
    val public = base(tap).setContentTitle("PhoneCanDo").setContentText(summary).build()
    return builder.setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public).build()
  }

  // Engines run and nothing else lists: one quiet line ("Claude Code,
  // opencode ready"), no buttons; the lock screen gets the count.
  private fun ready(agents: List<String>, tap: PendingIntent?): Notification {
    val public = base(tap).setContentTitle("PhoneCanDo").setContentText(ReadyLines.count(agents.size)).build()
    return base(tap).setContentTitle("PhoneCanDo").setContentText(ReadyLines.of(agents))
      .setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(public).build()
  }

  /**
   * What startForeground shows when nothing runs (yet): Android wants one
   * for every start of the service, which then leaves the foreground at
   * once. Android 12 and later hold a new foreground service's
   * notification back for some seconds, so it is not seen.
   */
  fun quiet(): Notification = base(launchIntent()).setContentTitle("PhoneCanDo").build()

  /**
   * What the notification shows once nothing is left running, for the few
   * seconds the service stays before it goes ("opencode stopped"), in
   * place of the last lines and their Stop buttons.
   */
  fun done(text: String): Notification = base(launchIntent()).setContentTitle("PhoneCanDo").setContentText(text).build()

  // The Stop buttons, line by line: each of its jobs alone ("Stop python3
  // -m http.server"), then the agent with all of it ("Stop opencode").
  private fun stops(
    lines: List<WorkLines.Line>,
    stop: (String) -> PendingIntent?,
    stopJob: (String, WorkWatch.Job) -> PendingIntent?,
  ): List<Pair<String, PendingIntent>> = lines.flatMap { line ->
    line.jobs.mapNotNull { job -> stopJob(line.agentId, job)?.let { "Stop ${job.name}" to it } } +
      listOfNotNull(stop(line.agentId)?.let { "Stop ${line.name}" to it })
  }

  // "1 stopping": no names.
  private fun stoppingCount(stopping: List<String>): String = if (stopping.isEmpty()) "" else "${stopping.size} stopping"

  // "1 agent starting": no names.
  private fun startingCount(starting: List<String>): String = when (starting.size) {
    0 -> ""
    1 -> "1 agent starting"
    else -> "${starting.size} agents starting"
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
    // No model name, so the lock screen may show it.
    private const val READING = "reading the prompt"

    // The update download, counted for the lock screen.
    private const val UPDATE = "update coming in"

    // InboxStyle shows about five lines; the rest are counted.
    private const val MAX_LINES = 5

    // Stop buttons for the agents kept up; Android shows three actions at most.
    private const val MAX_ACTIONS = 3
  }
}
