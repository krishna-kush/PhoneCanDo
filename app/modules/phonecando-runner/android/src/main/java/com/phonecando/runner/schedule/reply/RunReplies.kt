package com.phonecando.runner.schedule.reply

import android.content.Context
import android.util.Log
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.schedule.ScheduleEvents
import com.phonecando.runner.schedule.ScheduleRuns
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

// A scheduled run's chat and the agent's reply there (ScheduleRun.chatId,
// reply), and the notice its end posts (ReplyNotice). Firing owns it.
// - ACP: the turn's chat and final text, read off the agent's snapshot as
//   the turn ends (acp/AcpRelay, RunReply.ofAcp), go on the run before
//   Firing settles or fails it.
// - a server kind: the run waits for its task to go into a chat (the
//   mailbox's InboxCourier tells Schedules which); that chat goes on the
//   run and is watched (ReplyWatch) until a run there ends, and then its
//   reply is read through the kind's `chats.reply` (ReplyFetch) on a
//   thread of its own, never the scheduler's or a stream's. A read that
//   fails leaves the reply null; the run stays as it is.
// - a terminal start, a hook or reader wake, a task left for you: neither.
// A run's end in a chat posts one notice (none for a run you stopped).
internal class RunReplies(
  context: Context,
  private val runs: ScheduleRuns,
  clock: () -> Long,
) {
  private val app = context.applicationContext ?: context
  private val watch = ReplyWatch(clock)
  private val fetch = ReplyFetch(app)
  private val notice = ReplyNotice(app)
  private val reader: ExecutorService by lazy {
    Executors.newSingleThreadExecutor { r -> Thread(r, "phonecando-schedule-replies").apply { isDaemon = true } }
  }

  /** The ACP turn the run [seq] began ended in [chatId], saying [reply]. */
  fun acpEnded(agentId: String, seq: Long, chatId: String?, reply: String?, end: RunEnd) {
    if (chatId == null && reply == null) return
    record(seq, chatId, reply)
    if (end != RunEnd.STOPPED) notice.post(agentId, chatId, reply, failed = end == RunEnd.FAILED)
  }

  /** The run [seq] sent its task to a server kind's [agentId]: the chat it goes into is its. */
  fun coming(agentId: String, scheduleId: String, seq: Long) = watch.coming(agentId, ReplyWatch.Run(scheduleId, seq))

  /** The mailbox put [scheduleId]'s task into [agentId]'s chat [sessionId] (the scheduler's thread). */
  fun delivered(agentId: String, scheduleId: String, sessionId: String) {
    val run = watch.delivered(agentId, scheduleId, sessionId) ?: return
    record(run.seq, sessionId, null)
  }

  /** An event of [agentId]'s engine (its stream's thread): a watched chat's run that ended gets its reply. */
  fun onEvent(agentId: String, event: EngineEvent) {
    val sessionId = event.sessionId ?: return
    val end = RunEnd.of(event) ?: return
    val run = watch.ended(agentId, sessionId) ?: return
    if (end == RunEnd.STOPPED) return
    reader.execute {
      val reply = try {
        RunReply.cap(fetch.read(agentId, sessionId))
      } catch (e: Exception) {
        Log.w(TAG, "reply of $agentId not read", e)
        null
      }
      try {
        if (reply != null) record(run.seq, null, reply)
        notice.post(agentId, sessionId, reply, failed = end == RunEnd.FAILED)
      } catch (e: Exception) {
        Log.w(TAG, "reply of $agentId not kept", e)
      }
    }
  }

  /** [agentId]'s engine stopped: its chats are no longer watched. */
  fun engineGone(agentId: String) = watch.engineGone(agentId)

  fun forget(agentId: String) = watch.forget(agentId)

  private fun record(seq: Long, chatId: String?, reply: String?) {
    if (runs.answer(seq, chatId, reply) != null) ScheduleEvents.changed()
  }

  private companion object {
    const val TAG = "PhoneCanDoSchedules"
  }
}
