package com.phonecando.runner.schedule

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.checks.CheckChange
import com.phonecando.runner.checks.CheckState
import com.phonecando.runner.checks.fanout.CheckFanOut
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.starts.EngineStarts
import com.phonecando.runner.engine.starts.StartHolds
import com.phonecando.runner.messages.MessageRules
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.messages.ScheduledNote
import com.phonecando.runner.messages.delivery.Handover
import java.time.ZoneId
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

// What a due task does, on the scheduler's thread (Schedules):
// - at the alarm: each due schedule (DueRules) is missed (logged, not run)
//   or fires; every waiting firing is decided again, and skipped as busy
//   past its deadline.
// - a firing reads its agent (LiveFireState) and acts as FireRules says:
//   start with the task as first prompt; start, then wake with it (a
//   server kind); wake it; restart it with the task; for a kind with an
//   ACP mode, start it in that mode or switch it there with the task as
//   first prompt, or prompt it there; wait for it to be idle; or ask you
//   (ASK_USER: the task as a notice it reads next turn, and DueNotice).
//   Everything that makes the agent work, a wake too, goes
//   through the engine service's start request (EngineStarts) first, so it
//   needs the alarm's leave to start the service (Window.ALARM; a restart
//   only with exact alarms, as stopping first would leave the agent down)
//   or the app in front (Window.FRONT, Run now). Decided anywhere else (a
//   wait that ended, Window.NONE) it goes through a fresh alarm START_ALARM_MS
//   away, or asks you when alarms are inexact.
// - a wake, a start-then-wake and an ACP prompt post the task through the
//   mailbox as a scheduled notice (ScheduledNote: it wakes whatever the
//   agent's wake switch and budget say; in ACP mode it goes in as a
//   prompt); a start puts its first prompt in StartPrompts. The task's note
//   names its timing, or for a Run now when it ran (a wait keeps that);
//   a once you Run now is done after it, as after its own time.
// - a start we asked for that fails (its engine FAILED or DIED before ready)
//   turns its run to failed, and the agent's other tasks fail for
//   StartHolds.HOLD_MS rather than start it again (a message does not start
//   it then either). Except an ACP start of
//   a kind that takes a first prompt: its own app gets the task instead, as
//   before ACP mode (inTerminal), so ACP mode never leaves a schedule worse
//   off; the run says why ACP mode did not start. A switch to ACP mode
//   stops the terminal engine first: that engine's statuses are not ours.
// - an ACP turn the task began (its first prompt, or the prompt) that ends
//   with an error, a refusal or a limit (AcpTurnEnds), or whose engine dies
//   mid-turn, turns its run to failed.
// - a terminal start with the task as its first prompt stays watched for
//   RunWatch.TASK_WINDOW_MS after READY: its kind's task check failing then
//   (checks/, through CheckFanOut) fails its run with the check's detail.
// - a hook or reader wake (its notice left in the inbox folder) whose
//   notice is still unread a minute later fails its run.
// - a run stays open (ScheduleRun.open) from its start until its engine is
//   ready (a terminal start) or until the ACP turn it began ends. Android
//   may close PhoneCanDo meanwhile (the memory killer): that start or turn
//   went with it, and what Firing kept to settle it too. So the first
//   Firing of a process fails every run still open (APP_CLOSED) rather
//   than run it again: missed runs are never replayed, the agent may have
//   taken the task already, and a start that ran the phone out of memory
//   would only do so again. The next due time runs as usual.
// One waiting firing per schedule: one due while another waits is busy.
// Each outcome goes to the runs log and the schedule's lastRun.
internal class Firing(
  context: Context,
  private val book: ScheduleBook,
  private val runs: ScheduleRuns,
  private val alarms: ScheduleAlarms,
  private val clock: () -> Long = System::currentTimeMillis,
  private val zone: () -> ZoneId = ZoneId::systemDefault,
) {
  enum class Window {
    /** Inside an alarm's broadcast: Android lets it start the engine service. */
    ALARM,

    /** The app is in front (Run now): it may start the service too. */
    FRONT,

    /** Anywhere else: what needs the service goes through an alarm. */
    NONE,
  }

  private val app = context.applicationContext ?: context
  private val live = LiveFireState(app)
  private val starts = EngineStarts(app)
  private val dueNotice = DueNotice(app)

  // Agents we asked to start, and when (they count as starting meanwhile).
  private val asked = ConcurrentHashMap<String, Long>()

  /**
   * A start we asked for: the schedule and run it belongs to, whether in ACP
   * mode, whether a terminal start with the task as its first prompt, and
   * the task's note (its own app gets it if ACP mode fails, inTerminal).
   */
  private class StartRun(val scheduleId: String, val seq: Long, val acp: Boolean, val task: Boolean, val note: ScheduledNote)

  // Per agent we started: the schedule and the run that start belongs to.
  private val startRuns = ConcurrentHashMap<String, StartRun>()

  // Per agent: the schedule and run whose ACP turn is going.
  private val acpTurns = ConcurrentHashMap<String, Pair<String, Long>>()

  // Per agent: why a start of ours, or of a message's, failed lately.
  private val holds = StartHolds.shared

  // Runs watched after they were logged: a start's task window, a wake's receipt.
  private val watch = RunWatch(clock)

  private val timer: ScheduledExecutorService by lazy {
    Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "phonecando-schedule-watch").apply { isDaemon = true } }
  }

  init {
    CheckFanOut.listen(::onCheck)
    closeCutOff()
  }

  /** One firing of [schedule]: when it was due and fired, whether late, and whether you asked for it ([runNow]). */
  private class Shot(
    val schedule: Schedule,
    val dueAt: Long,
    val firedAt: Long,
    val late: Boolean,
    val waiting: Waiting?,
    val runNow: Boolean = false,
  )

  // ---- entry points (the scheduler's thread) ----------------------------------------

  fun onAlarm() {
    val now = clock()
    for (due in book.takeDue()) {
      val shot = Shot(due.schedule, due.dueAt, now, due.late, null)
      if (!due.run) {
        done(shot, agentOf(shot), RunOutcome.MISSED, "the phone was off or PhoneCanDo was not running more than a day past its time")
      } else {
        fire(shot, Window.ALARM)
      }
    }
    recheck(Window.ALARM)
  }

  /** The engines or their chats changed: waiting firings are decided again. */
  fun onEngines() {
    if (book.waiting().isNotEmpty()) recheck(Window.NONE)
  }

  /** Run now, from the app in front; null when it fired, else why not. A once is done after it (ScheduleBook.ranNow). */
  fun runNow(id: String): String? {
    val s = book.get(id) ?: return "no schedule with that id"
    val now = clock()
    book.unwait(s.id)
    book.ranNow(s.id)
    fire(Shot(s, now, now, false, null, runNow = true), Window.FRONT)
    return null
  }

  /**
   * An engine's status, on the thread that changed it (a stop's STOPPED
   * comes before a restart's start is asked): a start of ours that ended
   * before ready failed.
   */
  fun onStatus(status: EngineStatus) {
    val id = status.agentId
    val acp = status.mode == EngineMode.ACP
    // The terminal engine a switch to ACP mode stops is not the start we
    // asked for; a failed start is, whatever mode it names.
    if (startRuns[id]?.acp == true && !acp && status.state != EngineState.FAILED) return
    when (status.state) {
      EngineState.READY -> {
        asked.remove(id)
        val start = startRuns.remove(id)
        if (start != null && start.task) watch.ready(id, RunWatch.Run(start.scheduleId, start.seq))
        // A terminal start is done once ready; an ACP one once its turn ends.
        if (start != null && !start.acp) runs.settle(start.seq)
      }
      EngineState.STOPPED -> {
        asked.remove(id)
        startRuns.remove(id)?.let { runs.settle(it.seq) }
        if (acp) acpTurns.remove(id)?.let { runs.settle(it.second) }
      }
      EngineState.FAILED, EngineState.DIED -> {
        asked.remove(id)
        val start = startRuns.remove(id)
        val turn = if (acp) acpTurns.remove(id) else null
        if (start != null) {
          val why = "the agent did not start: " + (status.error ?: "its engine ended")
          if (start.acp && inTerminal(id, start, status.error ?: "its engine ended")) return
          holds.failed(id, status.error ?: "its engine ended")
          fail(start.scheduleId, start.seq, why)
        } else if (turn != null) {
          fail(turn.first, turn.second, "the agent's engine ended mid-task: " + (status.error ?: "no detail"))
        }
      }
      else -> {}
    }
  }

  /** An ACP turn of [agentId] ended (AcpRelay, on the scheduler's thread): one a task began that ended badly fails its run. */
  fun onAcpTurnEnd(agentId: String, stopReason: String?, error: String?) {
    val (scheduleId, seq) = acpTurns.remove(agentId) ?: return
    val failure = AcpTurnEnds.failure(stopReason, error)
    if (failure != null) fail(scheduleId, seq, failure) else runs.settle(seq)
  }

  /** A check changed (CheckFanOut, on its thread): the task check failing inside a start's window fails that run. */
  fun onCheck(change: CheckChange) {
    if (change.capability.wire != TASK || change.record.state != CheckState.FAILED) return
    val run = watch.taskFailed(change.agentId) ?: return
    fail(run.scheduleId, run.seq, change.record.detail?.takeIf { it.isNotBlank() } ?: RunWatch.TASK_QUIT)
  }

  fun forget(agentId: String) {
    asked.remove(agentId)
    startRuns.remove(agentId)?.let { runs.settle(it.seq) }
    acpTurns.remove(agentId)?.let { runs.settle(it.second) }
    holds.forget(agentId)
    watch.forget(agentId)
  }

  // An ACP start of [agentId] failed before ready ([acpWhy]: not installed,
  // a sign-in only ACP mode wants, a crash): a kind that takes a first
  // prompt starts in its own app with the task, as before ACP mode. False
  // when it can't (no such kind, the schedule gone, the start refused).
  private fun inTerminal(agentId: String, start: StartRun, acpWhy: String): Boolean {
    val s = book.get(start.scheduleId) ?: return false
    val agent = AgentStores.get(app).get(agentId) ?: return false
    if (!live.read(agent, s.chat, null, clock()).kindPrompts) return false
    if (starts.start(agentId, start.note.line(s.text), s.chat == ChatMode.NEW) != null) return false
    asked[agentId] = clock()
    val detail = "ACP mode did not start ($acpWhy), so its own app took the task"
    runs.update(start.seq, RunOutcome.STARTED, detail, open = true)
    book.ran(start.scheduleId, LastRun(clock(), RunOutcome.STARTED, detail))
    startRuns[agentId] = StartRun(start.scheduleId, start.seq, acp = false, task = true, start.note)
    Log.i(TAG, "schedule ${start.scheduleId}: ACP mode of $agentId did not start, its own app took the task")
    return true
  }

  private fun fail(scheduleId: String, seq: Long, why: String) {
    runs.update(seq, RunOutcome.FAILED, why)
    book.ran(scheduleId, LastRun(clock(), RunOutcome.FAILED, why))
  }

  // Runs an earlier process left open: cut off with it. A schedule's
  // lastRun changes only when that run is still its newest.
  private fun closeCutOff() {
    for ((run, newest) in runs.closeOpen(APP_CLOSED)) {
      if (newest) book.ran(run.scheduleId, LastRun(clock(), RunOutcome.FAILED, APP_CLOSED))
    }
  }

  // ---- deciding ------------------------------------------------------------------------

  private fun fire(shot: Shot, window: Window) {
    if (book.waiting().any { it.scheduleId == shot.schedule.id }) {
      done(shot, agentOf(shot), RunOutcome.BUSY, "its last run still waits for the agent", keepWaiting = true)
      return
    }
    act(shot, window)
  }

  private fun recheck(window: Window) {
    val now = clock()
    for (w in book.waiting()) {
      val s = book.get(w.scheduleId)
      if (s == null) {
        book.unwait(w.scheduleId)
        continue
      }
      val shot = Shot(s, w.dueAt, w.firedAt, w.late, w, w.runNow)
      if (now >= w.until) {
        done(shot, agentOf(shot), RunOutcome.BUSY, "the agent stayed busy ${TimingText.span((ScheduleRules.BUSY_WAIT_MS / ScheduleRules.MINUTE_MS).toInt())} past its time")
      } else {
        act(shot, window)
      }
    }
  }

  private fun act(shot: Shot, window: Window) {
    val s = shot.schedule
    val agent = agentOf(shot)
    if (agent == null) {
      done(shot, null, RunOutcome.FAILED, "the agent is gone")
      return
    }
    val now = clock()
    // Run now: you asked for it in the app, so an idle agent may be
    // restarted with it even though the app is in front.
    val state = live.read(agent, s.chat, asked[agent.id], now)
      .let { if (window == Window.FRONT) it.copy(appInFront = false) else it }
    val action = FireRules.decide(state)
    when (action) {
      FireRules.Action.WAIT_IDLE -> waitFor(shot)
      FireRules.Action.UNSUPPORTED -> done(shot, agent, RunOutcome.FAILED, "its kind cannot run scheduled tasks")
      FireRules.Action.ASK_USER -> ask(shot, agent, null, posted = false)
      else -> {
        val starting = action != FireRules.Action.WAKE && action != FireRules.Action.PROMPT_ACP
        // Run now is yours, in the app: never held.
        val failed = if (window == Window.FRONT) null else holds.why(agent.id)
        if (starting && failed != null) {
          done(shot, agent, RunOutcome.FAILED, "the agent did not start: $failed")
          return
        }
        val may = when (window) {
          Window.FRONT -> true
          Window.ALARM -> action != FireRules.Action.RESTART_WITH_PROMPT || alarms.exact()
          Window.NONE -> state.appInFront
        }
        when {
          may -> run(shot, agent, action)
          window == Window.NONE && alarms.exact() -> later(shot)
          else -> ask(shot, agent, "PhoneCanDo may not start or wake agents in the background without Alarms & reminders", posted = false)
        }
      }
    }
  }

  // ---- acting ----------------------------------------------------------------------------

  private fun run(shot: Shot, agent: AgentRecord, action: FireRules.Action) {
    val s = shot.schedule
    val note = note(shot)
    val newChat = s.chat == ChatMode.NEW
    when (action) {
      FireRules.Action.START_WITH_PROMPT -> {
        val why = starts.start(agent.id, note.line(s.text), newChat)
        if (why != null) return ask(shot, agent, why, posted = false)
        started(shot, agent, RunOutcome.STARTED, task = true)
      }
      FireRules.Action.START_THEN_WAKE -> {
        val why = starts.start(agent.id)
        if (why != null) return ask(shot, agent, why, posted = false)
        Messages.get(app).mailbox.notice(agent.id, s.text, wake = true, scheduled = note)
        started(shot, agent, RunOutcome.STARTED)
      }
      FireRules.Action.RESTART_WITH_PROMPT -> {
        starts.stop(agent.id)
        val why = starts.start(agent.id, note.line(s.text), newChat)
        if (why != null) return ask(shot, agent, why, posted = false)
        started(shot, agent, RunOutcome.RESTARTED, task = true)
      }
      FireRules.Action.WAKE -> {
        val why = starts.start(agent.id)
        if (why != null) return ask(shot, agent, why, posted = false)
        val noticed = Messages.get(app).mailbox.notice(agent.id, s.text, wake = true, scheduled = note)
        if (noticed?.woke == true) {
          val seq = done(shot, agent, RunOutcome.WOKE, null)
          // A hook or reader wake: the notice waits in its inbox folder for a receipt.
          if (noticed?.handover == Handover.HELD) watchReceipt(agent.id, s, seq)
        } else {
          ask(shot, agent, "it could not be woken", posted = true)
        }
      }
      // A switch stops its terminal engine in the same start request, so it
      // needs no exact alarm: refused, nothing was stopped.
      FireRules.Action.START_ACP_WITH_PROMPT, FireRules.Action.SWITCH_TO_ACP_WITH_PROMPT -> {
        val why = starts.start(agent.id, note.line(s.text), newChat, EngineMode.ACP)
        if (why != null) return ask(shot, agent, why, posted = false)
        val outcome = if (action == FireRules.Action.START_ACP_WITH_PROMPT) RunOutcome.STARTED else RunOutcome.RESTARTED
        started(shot, agent, outcome, acp = true)
      }
      FireRules.Action.PROMPT_ACP -> {
        val why = starts.start(agent.id, mode = EngineMode.ACP)
        if (why != null) return ask(shot, agent, why, posted = false)
        val noticed = Messages.get(app).mailbox.notice(agent.id, s.text, wake = true, scheduled = note)
        if (noticed == null || !noticed.woke) return ask(shot, agent, "it could not be woken", posted = true)
        val prompted = noticed.handover == Handover.WOKE
        val seq = done(shot, agent, RunOutcome.WOKE, null, open = prompted)
        if (prompted) turn(agent.id, s.id, seq)
      }
      else -> ask(shot, agent, null, posted = false)
    }
  }

  private fun started(shot: Shot, agent: AgentRecord, outcome: RunOutcome, acp: Boolean = false, task: Boolean = false) {
    asked[agent.id] = clock()
    val seq = done(shot, agent, outcome, null, open = true)
    startRuns.put(agent.id, StartRun(shot.schedule.id, seq, acp, task, note(shot)))?.let { runs.settle(it.seq) }
    if (acp) turn(agent.id, shot.schedule.id, seq)
  }

  // [agentId]'s ACP turn is the run [seq]'s; one it replaced is no longer followed.
  private fun turn(agentId: String, scheduleId: String, seq: Long) {
    acpTurns.put(agentId, scheduleId to seq)?.let { if (it.second != seq) runs.settle(it.second) }
  }

  // The notice the wake just left for [s]: looked at again once a receipt is due.
  private fun watchReceipt(agentId: String, s: Schedule, seq: Long) {
    val id = Messages.get(app).mailbox.recent(MessageRules.LOG_PAGE_MAX)
      .firstOrNull { it.notice && it.to == agentId && it.scheduled?.scheduleId == s.id }?.id ?: return
    watch.woke(agentId, id, RunWatch.Run(s.id, seq))
    timer.schedule(Runnable { receipts() }, RunWatch.WAKE_RECEIPT_MS + RECEIPT_SLACK_MS, TimeUnit.MILLISECONDS)
  }

  // Wakes whose time for a receipt is up: a notice still unread fails its run.
  private fun receipts() {
    try {
      val mailbox = Messages.get(app).mailbox
      val failed = watch.receiptsDue { agentId, id ->
        mailbox.recent(MessageRules.LOG_PAGE_MAX).firstOrNull { it.id == id }?.deliveryTo(agentId)?.unread == true
      }
      for (run in failed) fail(run.scheduleId, run.seq, RunWatch.WAKE_UNTAKEN)
    } catch (e: Exception) {
      Log.w(TAG, "wake receipts not checked", e)
    }
  }

  // ASK_USER: the task waits as a notice (unless the wake already posted
  // it), and a notification asks you to open the agent.
  private fun ask(shot: Shot, agent: AgentRecord, why: String?, posted: Boolean) {
    val s = shot.schedule
    if (!posted) Messages.get(app).mailbox.notice(agent.id, s.text, wake = false, scheduled = note(shot))
    dueNotice.post(agent.id, agent.name, s.text)
    done(shot, agent, RunOutcome.ASKED, why)
  }

  private fun waitFor(shot: Shot) {
    val w = shot.waiting
    when {
      w == null -> book.wait(
        Waiting(shot.schedule.id, shot.dueAt, shot.firedAt, shot.late, until = shot.dueAt + ScheduleRules.BUSY_WAIT_MS, runNow = shot.runNow),
      )
      w.retryAt != null -> book.wait(w.copy(retryAt = null))
    }
  }

  // Decided outside an alarm: an alarm START_ALARM_MS away decides again and acts.
  private fun later(shot: Shot) {
    val retryAt = clock() + ScheduleRules.START_ALARM_MS
    val w = shot.waiting
      ?: Waiting(shot.schedule.id, shot.dueAt, shot.firedAt, shot.late, until = shot.dueAt + ScheduleRules.BUSY_WAIT_MS, runNow = shot.runNow)
    if (w.retryAt == null) book.wait(w.copy(retryAt = retryAt))
  }

  /** Logs the outcome ([open]: its start or turn still goes), sets the schedule's lastRun and ends its wait; the run's seq. */
  private fun done(
    shot: Shot,
    agent: AgentRecord?,
    outcome: RunOutcome,
    detail: String?,
    keepWaiting: Boolean = false,
    open: Boolean = false,
  ): Long {
    val s = shot.schedule
    val run = runs.add { seq ->
      ScheduleRun(
        seq = seq,
        scheduleId = s.id,
        agentId = s.agentId,
        agentName = agent?.name.orEmpty(),
        text = s.text.take(ScheduleRules.RUN_TEXT_MAX),
        by = s.by,
        dueAt = shot.dueAt,
        firedAt = shot.firedAt,
        late = shot.late,
        outcome = outcome,
        detail = detail,
        open = open,
      )
    }
    if (!keepWaiting) book.unwait(s.id)
    book.ran(s.id, LastRun(clock(), outcome, detail))
    return run.seq
  }

  private fun agentOf(shot: Shot): AgentRecord? = AgentStores.get(app).get(shot.schedule.agentId)

  // The task's note; a Run now says when it ran, not its timing's next time.
  private fun note(shot: Shot): ScheduledNote {
    val s = shot.schedule
    val timing = if (shot.runNow) TimingText.ranNow(shot.firedAt, zone()) else TimingText.of(s.timing, zone())
    return ScheduledNote(s.id, s.by.wire, s.chat == ChatMode.NEW, timing)
  }

  private companion object {
    const val TAG = "PhoneCanDoSchedules"

    /** The task capability's wire id (kit Capability). */
    const val TASK = "task"

    /** Past a wake's receipt time before we look, so the clock has passed it. */
    const val RECEIPT_SLACK_MS = 250L

    /** Why a run an earlier process left open failed. */
    const val APP_CLOSED = "PhoneCanDo was closed before the task finished"
  }
}
