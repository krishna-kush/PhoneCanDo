package com.phonecando.runner.checks.now

import com.phonecando.runner.checks.TurnEnd
import com.phonecando.runner.checks.now.CheckRun.RowStatus
import com.phonecando.runner.checks.now.CheckRun.State
import com.phonecando.runner.checks.now.CheckRun.Step
import com.phonecando.runner.checks.rules.CheckRules
import com.phonecando.runner.engine.EngineMode

// Each agent's last Check now (CheckRun) through its parts (CheckPlan):
// - begin: running from now, part 1 (refused while one runs). Its rows:
//   part 1's testing, later parts' queued, what no part can test skipped.
//   A part's engine news counts only once its start was asked for
//   (launched), so the stop of the engine before it is not its end.
// - a verdict for a testing row of the part now running answers it.
// - each tick (every TICK_MS while one runs) takes a look at the agent
//   (CheckSample): its step (CheckSample.step), and movedAt moves when the
//   look's print changed, or, in its own app, while a view shows its
//   terminal (you are with it).
// - waiting: in its own app, working (it shows something: a TUI is ready
//   once it does) and nothing moved for STALL_MS: it may be asking you
//   something there (a sign-in, a folder to trust). The run goes on (the
//   caller tells you); any move ends the wait.
// - a part ends as soon as none of its rows is testing (a part whose ACP chat
//   a later part opens, once its engine was seen ready too); else DONE_MS after
//   its turn end (once the checks that wait out GRACE_MS have spoken), or,
//   with no task, CHAT_DONE_MS after its engine was first seen ready (when
//   the chat it opened is judged); rows still testing then are unknown.
//   Then the next part starts (Action.Advance: its engine, an ACP turn
//   cancelled first, is stopped and started again), or the run is done.
// - its engine ended before its turn end: failed, with the engine's detail
//   when it failed or died, else as stopped. An end while an engine of it
//   runs again was an older life's, and is passed over. Its start refused:
//   failed with why.
// - stuck: in ACP mode, nothing moved for STUCK_MS (not while a question
//   waits); in any part, it ran CHECK_MAX_MS. The detail says whether a
//   view shows its terminal.
// - done or stuck in a tick: Action.Ended (the caller stops its engine
//   unless a view shows its terminal, and tells you).
// - cancelled: you cancelled it (the caller stops its engine).
// A run that ends with rows still testing or queued leaves them unknown.
// Kept until the next check or forget. Thread-safe; pure: the clock is
// injected.
class CheckRuns(private val clock: () -> Long) {
  /** What the caller does after a tick. */
  sealed interface Action {
    /** Start part [number] (1-based): stop its engine if live (an ACP turn cancelled first), then start it as [part] says. */
    data class Advance(val number: Int, val part: CheckPlan.Part) : Action

    /** The run ended, done or stuck. */
    data object Ended : Action
  }

  /** A tick's news of one agent: [changed] what the app shows, and what to do. */
  data class Tick(val agentId: String, val changed: Boolean, val action: Action?)

  private class Entry(val plan: CheckPlan, var run: CheckRun) {
    var launched = false
    var turnEndAt: Long? = null

    /** How that turn ended: a failed or stopped one leaves its rows a reason of its own. */
    var turnEnd = TurnEnd.FINISHED
    var readyAt: Long? = null
    var print: CheckSample.Print? = null

    val part: CheckPlan.Part get() = plan.parts[run.part - 1]
  }

  private val runs = HashMap<String, Entry>()

  @Synchronized
  fun get(agentId: String): CheckRun? = runs[agentId]?.run

  /** A check begins for [agentId] as [plan] says; false while one already runs. */
  @Synchronized
  fun begin(agentId: String, plan: CheckPlan): Boolean {
    if (runs[agentId]?.run?.running == true) return false
    val now = clock()
    val rows = plan.parts.flatMapIndexed { i, part ->
      val number = i + 1
      part.tests.map { CheckRun.Row(it, number, if (number == 1) RowStatus.TESTING else RowStatus.QUEUED) } +
        part.skips.map { CheckRun.Row(it, number, RowStatus.SKIPPED, CheckRunCopy.SKIPPED) }
    }
    val run = CheckRun(State.RUNNING, now, now, part = 1, parts = plan.parts.size, partMode = plan.parts[0].mode, step = Step.STARTING, rows = rows)
    runs[agentId] = Entry(plan, run)
    return true
  }

  /** Part [number]'s start was asked for: its engine's news counts from now. */
  @Synchronized
  fun launched(agentId: String, number: Int) {
    val e = runs[agentId]?.takeIf { it.run.running && it.run.part == number } ?: return
    e.launched = true
  }

  /** A verdict for capability [id] ([failed]: Not working): true when it answered a row testing now. */
  @Synchronized
  fun verdict(agentId: String, id: String, failed: Boolean): Boolean {
    val e = going(agentId)?.takeIf { it.launched } ?: return false
    val number = e.run.part
    val row = e.run.rows.firstOrNull { it.id == id && it.part == number } ?: return false
    if (row.status != RowStatus.TESTING && row.status != RowStatus.ANSWERED) return false
    e.setRows { if (it === row) it.copy(status = RowStatus.ANSWERED, failed = failed) else it }
    return row.status == RowStatus.TESTING
  }

  /** Its start was refused: failed with [why]; true when that changed it. */
  @Synchronized
  fun refused(agentId: String, why: String): Boolean {
    val e = going(agentId) ?: return false
    e.end(State.FAILED, why)
    return true
  }

  /** A turn of its engine in [mode] ended, as [end] says: true when that was its part's turn end. */
  @Synchronized
  fun turnEnded(agentId: String, mode: EngineMode, end: TurnEnd = TurnEnd.FINISHED): Boolean {
    val e = going(agentId)?.takeIf { it.launched && it.turnEndAt == null && it.part.task != null && it.part.mode == mode } ?: return false
    e.turnEndAt = clock()
    e.turnEnd = end
    return true
  }

  /**
   * Its engine ended: [failed] when it failed or died ([detail] says why);
   * [liveNow] when an engine of it runs again. True when the run changed.
   */
  @Synchronized
  fun engineEnded(agentId: String, failed: Boolean, detail: String?, liveNow: Boolean): Boolean {
    val e = going(agentId)?.takeIf { it.launched && it.turnEndAt == null } ?: return false
    if (liveNow) return false
    e.end(State.FAILED, if (failed) detail?.trim()?.takeIf { it.isNotEmpty() } ?: CheckRunCopy.ENGINE_FAILED else CheckRunCopy.STOPPED)
    return true
  }

  /** You cancelled it: true when it was running (the caller stops its engine). */
  @Synchronized
  fun cancel(agentId: String): Boolean {
    val e = going(agentId) ?: return false
    e.end(State.CANCELLED, null)
    return true
  }

  /** The agents with a run going, and the mode of the part each is on. */
  @Synchronized
  fun going(): Map<String, EngineMode> = runs.filterValues { it.run.running }.mapValues { it.value.part.mode }

  @Synchronized
  fun active(): Boolean = runs.values.any { it.run.running }

  /** One tick with a look at each agent whose run goes ([samples] by agent id; one without a look waits). */
  @Synchronized
  fun tick(samples: Map<String, CheckSample>): List<Tick> {
    val now = clock()
    val ticks = ArrayList<Tick>()
    for ((agentId, e) in runs) {
      if (!e.run.running) continue
      val sample = samples[agentId] ?: continue
      val before = e.run
      val action = e.step(now, sample)
      val changed = shows(before) != shows(e.run)
      if (changed || action != null) ticks += Tick(agentId, changed, action)
    }
    return ticks
  }

  @Synchronized
  fun forget(agentId: String) {
    runs.remove(agentId)
  }

  private fun going(agentId: String): Entry? = runs[agentId]?.takeIf { it.run.running }

  // What the app shows of a run: all of it, the reading as its whole percent
  // (a reading with no total moves movedAt as it reads).
  private fun shows(run: CheckRun) = run.copy(reading = null) to run.reading?.percent

  private fun Entry.setRows(change: (CheckRun.Row) -> CheckRun.Row) {
    run = run.copy(rows = run.rows.map(change))
  }

  // The run ends: rows of the part running, and of parts it never got to, unknown.
  private fun Entry.end(state: State, detail: String?) {
    setRows {
      when (it.status) {
        RowStatus.TESTING -> it.copy(status = RowStatus.UNKNOWN, why = CheckRunCopy.UNKNOWN_CUT)
        RowStatus.QUEUED -> it.copy(status = RowStatus.UNKNOWN, why = CheckRunCopy.UNKNOWN_NOT_REACHED)
        else -> it
      }
    }
    run = run.copy(state = state, step = null, reading = null, detail = detail)
  }

  // Looks at [sample]: the step, movement, a wait for you, then the part's end, stuck.
  private fun Entry.step(now: Long, sample: CheckSample): Action? {
    if (launched && sample.ready && readyAt == null) readyAt = now
    val taskless = part.task == null
    val inApp = part.mode == EngineMode.TERMINAL
    val step = CheckSample.step(launched, turnEndAt != null, taskless, readyAt != null, sample)
    val print = sample.print(step)
    val movedAt = if (print != this.print || (inApp && sample.viewer)) now else run.movedAt
    this.print = print
    val waits = inApp && step == Step.WORKING && now - movedAt >= STALL_MS
    run = run.copy(step = if (waits) Step.WAITING else step, reading = sample.reading?.takeIf { step == Step.READING }, movedAt = movedAt)

    val number = run.part
    val turnEnd = turnEndAt
    val ready = readyAt
    // Every row answered (or skipped): the part ends now. Else its time
    // ends it, and what is still testing is unknown, with why.
    val answered = launched && run.rows.none { it.part == number && it.status == RowStatus.TESTING } &&
      (!part.holdsChat || ready != null)
    val unknownWhy = when {
      answered -> null
      turnEnd != null && now - turnEnd >= DONE_MS -> when (this.turnEnd) {
        TurnEnd.FAILED -> CheckRunCopy.UNKNOWN_FAILED
        TurnEnd.STOPPED -> CheckRunCopy.UNKNOWN_STOPPED
        TurnEnd.FINISHED -> CheckRunCopy.UNKNOWN_AFTER_TURN
      }
      taskless && ready != null && now - ready >= CHAT_DONE_MS -> CheckRunCopy.UNKNOWN_NO_TURN
      else -> null
    }
    if (answered || unknownWhy != null) {
      if (unknownWhy != null) {
        setRows { if (it.part == number && it.status == RowStatus.TESTING) it.copy(status = RowStatus.UNKNOWN, why = unknownWhy) else it }
      }
      if (number == plan.parts.size) {
        end(State.DONE, null)
        return Action.Ended
      }
      val next = number + 1
      launched = false
      turnEndAt = null
      this.turnEnd = TurnEnd.FINISHED
      readyAt = null
      setRows { if (it.part == next && it.status == RowStatus.QUEUED) it.copy(status = RowStatus.TESTING) else it }
      run = run.copy(part = next, partMode = plan.parts[next - 1].mode, step = Step.STARTING, reading = null)
      return Action.Advance(next, plan.parts[next - 1])
    }
    val left = sample.viewer
    if (now - run.startedAt >= CHECK_MAX_MS) {
      end(State.STUCK, CheckRunCopy.tooLong(left))
      return Action.Ended
    }
    if (!inApp && step != Step.ANSWER && now - run.movedAt >= STUCK_MS) {
      end(State.STUCK, CheckRunCopy.stuck(step.words, left))
      return Action.Ended
    }
    return null
  }

  companion object {
    /** How often a running check looks at its agent. */
    const val TICK_MS = 1_000L

    /** After a turn end, how long the checks wait before a failure. */
    const val GRACE_MS = CheckRules.GRACE_MS

    /** A part's turn end to its end: GRACE_MS and a second. */
    const val DONE_MS = GRACE_MS + 1_000L

    /** A part with no task: from its engine first seen ready to its end, CHAT_HOLD_MS and a second. */
    const val CHAT_DONE_MS = CheckRules.CHAT_HOLD_MS + 1_000L

    /** In ACP mode, nothing moved this long (not while a question waits): stuck. */
    const val STUCK_MS = 180_000L

    /** In its own app, nothing moved this long while it works: waiting for you there. */
    const val STALL_MS = 60_000L

    /** A check running this long is stuck, moving or not. */
    const val CHECK_MAX_MS = 1_800_000L
  }
}
