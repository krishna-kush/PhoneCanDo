package com.phonecando.runner.schedule

import android.content.Context
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.messages.ScheduledNote
import java.time.ZoneId
import java.util.concurrent.ConcurrentHashMap

// What a due task does, on the scheduler's thread (Schedules):
// - at the alarm: each due schedule (DueRules) is missed (logged, not run)
//   or fires; every waiting firing is decided again, and skipped as busy
//   past its deadline.
// - a firing reads its agent (LiveFireState) and acts as FireRules says:
//   start with the task as first prompt; start, then wake with it (a
//   server kind); wake it; restart it with the task; wait for it to be
//   idle; or ask you (ASK_USER: the task as a notice it reads next turn,
//   and DueNotice). Everything that makes the agent work, a wake too, goes
//   through the engine service's start request (EngineStarts) first, so it
//   needs the alarm's leave to start the service (Window.ALARM; a restart
//   only with exact alarms, as stopping first would leave the agent down)
//   or the app in front (Window.FRONT, Run now). Decided anywhere else (a
//   wait that ended, Window.NONE) it goes through a fresh alarm START_ALARM_MS
//   away, or asks you when alarms are inexact.
// - a wake and a start-then-wake post the task through the mailbox as a
//   scheduled notice (ScheduledNote: it wakes whatever the agent's wake
//   switch and budget say); a start puts its first prompt in StartPrompts.
// - a start we asked for that fails (its engine FAILED or DIED before ready)
//   turns its run to failed, and the agent's other tasks fail for
//   FAILED_START_HOLD_MS rather than start it again.
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

  // Per agent we started: the schedule and the run that start belongs to.
  private val startRuns = ConcurrentHashMap<String, Pair<String, Long>>()

  // Per agent: when a start of ours failed, and why.
  private val failedStarts = ConcurrentHashMap<String, Pair<Long, String>>()

  /** One firing of [schedule]: when it was due and fired, and whether late. */
  private class Shot(val schedule: Schedule, val dueAt: Long, val firedAt: Long, val late: Boolean, val waiting: Waiting?)

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

  /** Run now, from the app in front; null when it fired, else why not. */
  fun runNow(id: String): String? {
    val s = book.get(id) ?: return "no schedule with that id"
    val now = clock()
    book.unwait(s.id)
    fire(Shot(s, now, now, false, null), Window.FRONT)
    return null
  }

  /**
   * An engine's status, on the thread that changed it (a stop's STOPPED
   * comes before a restart's start is asked): a start of ours that ended
   * before ready failed.
   */
  fun onStatus(status: EngineStatus) {
    val id = status.agentId
    when (status.state) {
      EngineState.READY, EngineState.STOPPED -> {
        asked.remove(id)
        startRuns.remove(id)
      }
      EngineState.FAILED, EngineState.DIED -> {
        asked.remove(id)
        val (scheduleId, seq) = startRuns.remove(id) ?: return
        val why = "the agent did not start: " + (status.error ?: "its engine ended")
        failedStarts[id] = clock() to why
        runs.update(seq, RunOutcome.FAILED, why)
        book.ran(scheduleId, LastRun(clock(), RunOutcome.FAILED, why))
      }
      else -> {}
    }
  }

  fun forget(agentId: String) {
    asked.remove(agentId)
    startRuns.remove(agentId)
    failedStarts.remove(agentId)
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
      val shot = Shot(s, w.dueAt, w.firedAt, w.late, w)
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
        val starting = action != FireRules.Action.WAKE
        val failed = failedStarts[agent.id]?.takeIf { now - it.first < ScheduleRules.FAILED_START_HOLD_MS }
        if (starting && failed != null) {
          done(shot, agent, RunOutcome.FAILED, failed.second)
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
    val note = note(s)
    val newChat = s.chat == ChatMode.NEW
    when (action) {
      FireRules.Action.START_WITH_PROMPT -> {
        val why = starts.start(agent.id, note.line(s.text), newChat)
        if (why != null) return ask(shot, agent, why, posted = false)
        started(shot, agent, RunOutcome.STARTED)
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
        started(shot, agent, RunOutcome.RESTARTED)
      }
      FireRules.Action.WAKE -> {
        val why = starts.start(agent.id)
        if (why != null) return ask(shot, agent, why, posted = false)
        val noticed = Messages.get(app).mailbox.notice(agent.id, s.text, wake = true, scheduled = note)
        if (noticed?.woke == true) {
          done(shot, agent, RunOutcome.WOKE, null)
        } else {
          ask(shot, agent, "it could not be woken", posted = true)
        }
      }
      else -> ask(shot, agent, null, posted = false)
    }
  }

  private fun started(shot: Shot, agent: AgentRecord, outcome: RunOutcome) {
    asked[agent.id] = clock()
    val seq = done(shot, agent, outcome, null)
    startRuns[agent.id] = shot.schedule.id to seq
  }

  // ASK_USER: the task waits as a notice (unless the wake already posted
  // it), and a notification asks you to open the agent.
  private fun ask(shot: Shot, agent: AgentRecord, why: String?, posted: Boolean) {
    val s = shot.schedule
    if (!posted) Messages.get(app).mailbox.notice(agent.id, s.text, wake = false, scheduled = note(s))
    dueNotice.post(agent.id, agent.name, s.text)
    done(shot, agent, RunOutcome.ASKED, why)
  }

  private fun waitFor(shot: Shot) {
    val w = shot.waiting
    when {
      w == null -> book.wait(
        Waiting(shot.schedule.id, shot.dueAt, shot.firedAt, shot.late, until = shot.dueAt + ScheduleRules.BUSY_WAIT_MS),
      )
      w.retryAt != null -> book.wait(w.copy(retryAt = null))
    }
  }

  // Decided outside an alarm: an alarm START_ALARM_MS away decides again and acts.
  private fun later(shot: Shot) {
    val retryAt = clock() + ScheduleRules.START_ALARM_MS
    val w = shot.waiting
      ?: Waiting(shot.schedule.id, shot.dueAt, shot.firedAt, shot.late, until = shot.dueAt + ScheduleRules.BUSY_WAIT_MS)
    if (w.retryAt == null) book.wait(w.copy(retryAt = retryAt))
  }

  /** Logs the outcome, sets the schedule's lastRun and ends its wait; the run's seq. */
  private fun done(shot: Shot, agent: AgentRecord?, outcome: RunOutcome, detail: String?, keepWaiting: Boolean = false): Long {
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
      )
    }
    if (!keepWaiting) book.unwait(s.id)
    book.ran(s.id, LastRun(clock(), outcome, detail))
    return run.seq
  }

  private fun agentOf(shot: Shot): AgentRecord? = AgentStores.get(app).get(shot.schedule.agentId)

  private fun note(s: Schedule) = ScheduledNote(s.id, s.by.wire, s.chat == ChatMode.NEW, TimingText.of(s.timing, zone()))
}
