package com.phonecando.runner.schedule

import java.time.ZoneId

// The schedules in memory, kept in step with their file (ScheduleStore):
// add, change, remove (the app, any schedule; an agent through the bridge,
// its own), what is due at an alarm (DueRules: nextAt moves on as they are
// taken), each one's last run, the firings that wait for their agent, and
// the time the one alarm goes off next (the soonest nextAt, retry or
// busy deadline). Caps: MAX_PER_AGENT schedules per agent, MAX_BY_AGENT of
// them set by the agent. A text the user changes makes the task the
// user's: its words are then the user's. [onChange] runs after every
// change, outside the lock (re-arms the alarm, tells the app). Thread-safe;
// pure apart from the store, with the clock, the zone and the ids injected.
class ScheduleBook(
  private val store: ScheduleStore,
  private val clock: () -> Long,
  private val zone: () -> ZoneId,
  /** Why [agentId] cannot have schedules (AGENT_GONE, UNSUPPORTED); null when it can. */
  private val refusal: (agentId: String) -> Result.Refused? = { null },
  private val newId: () -> String = ScheduleIds::next,
  private val onChange: () -> Unit = {},
  private val onError: (String, Throwable) -> Unit = { _, _ -> },
) {
  sealed interface Result {
    data class Ok(val schedule: Schedule) : Result

    data class Refused(val code: String, val reason: String) : Result
  }

  /** A new task; [chat] null: the default for its timing. */
  data class Draft(val text: String, val timing: Timing, val chat: ChatMode? = null)

  /** A change; null fields stay. */
  data class Patch(val text: String? = null, val timing: Timing? = null, val chat: ChatMode? = null, val on: Boolean? = null)

  private val schedules = ArrayList<Schedule>()
  private val waiting = ArrayList<Waiting>()

  init {
    val saved = store.load()
    schedules += saved.schedules
    waiting += saved.waiting
  }

  // ---- reads -------------------------------------------------------------------

  @Synchronized
  fun all(): List<Schedule> = schedules.toList()

  @Synchronized
  fun get(id: String): Schedule? = schedules.firstOrNull { it.id == id }

  @Synchronized
  fun of(agentId: String): List<Schedule> = schedules.filter { it.agentId == agentId }

  @Synchronized
  fun waiting(): List<Waiting> = waiting.toList()

  /** When the alarm should go off next: a due time, a retry or a busy deadline; null for none. */
  @Synchronized
  fun nextAlarm(): Long? {
    val due = schedules.filter { it.on }.mapNotNull { it.nextAt }
    val waits = waiting.flatMap { listOfNotNull(it.retryAt, it.until) }
    return (due + waits).minOrNull()
  }

  // ---- changes -------------------------------------------------------------------

  fun add(agentId: String, draft: Draft, by: SetBy): Result {
    val now = clock()
    val text = when (val t = ScheduleCheck.text(draft.text)) {
      is Checked.Ok -> t.value
      is Checked.Bad -> return bad(t.why)
    }
    ScheduleCheck.timing(draft.timing, now)?.let { return bad(it) }
    refusal(agentId)?.let { return it }
    val added = synchronized(this) {
      val mine = schedules.filter { it.agentId == agentId }
      if (mine.size >= ScheduleRules.MAX_PER_AGENT) {
        return Result.Refused(LIMIT, "an agent has at most ${ScheduleRules.MAX_PER_AGENT} schedules; remove one first")
      }
      if (by == SetBy.AGENT && mine.count { it.by == SetBy.AGENT } >= ScheduleRules.MAX_BY_AGENT) {
        return Result.Refused(LIMIT, "you can set at most ${ScheduleRules.MAX_BY_AGENT} schedules for yourself; cancel one first")
      }
      val s = Schedule(
        id = newId(),
        agentId = agentId,
        text = text,
        timing = draft.timing,
        chat = draft.chat ?: ChatMode.defaultFor(draft.timing),
        on = true,
        by = by,
        createdAt = now,
        nextAt = NextRun.after(draft.timing, now, zone()),
        lastRun = null,
      )
      schedules += s
      save()
      s
    }
    changed()
    return Result.Ok(added)
  }

  fun update(id: String, patch: Patch): Result {
    val now = clock()
    val text = patch.text?.let {
      when (val t = ScheduleCheck.text(it)) {
        is Checked.Ok -> t.value
        is Checked.Bad -> return bad(t.why)
      }
    }
    val updated = synchronized(this) {
      val i = schedules.indexOfFirst { it.id == id }
      if (i < 0) return notFound()
      val old = schedules[i]
      val timing = patch.timing ?: old.timing
      val on = patch.on ?: old.on
      val retimed = patch.timing != null || on != old.on
      if (on && retimed) ScheduleCheck.timing(timing, now)?.let { return bad(it) }
      val s = old.copy(
        text = text ?: old.text,
        timing = timing,
        chat = patch.chat ?: old.chat,
        on = on,
        by = if (text != null && text != old.text) SetBy.USER else old.by,
        nextAt = when {
          !on -> null
          retimed -> NextRun.after(timing, now, zone())
          else -> old.nextAt
        },
      )
      schedules[i] = s
      if (!on || patch.timing != null) waiting.removeAll { it.scheduleId == id }
      save()
      s
    }
    changed()
    return Result.Ok(updated)
  }

  fun remove(id: String): Boolean {
    val removed = synchronized(this) {
      val gone = schedules.removeAll { it.id == id }
      if (gone) {
        waiting.removeAll { it.scheduleId == id }
        save()
      }
      gone
    }
    if (removed) changed()
    return removed
  }

  /** schedule_cancel: [agentId] takes back one it set itself; one the user set stays. */
  fun cancelByAgent(agentId: String, id: String): Result {
    val s = get(id)?.takeIf { it.agentId == agentId } ?: return notFound()
    if (s.by != SetBy.AGENT) {
      return Result.Refused(NOT_ALLOWED, "set by the user; ask them to change it in PhoneCanDo's Schedules")
    }
    return if (remove(id)) Result.Ok(s) else notFound()
  }

  /** A deleted agent: its schedules go. */
  fun forget(agentId: String): Boolean {
    val gone = synchronized(this) {
      val ids = schedules.filter { it.agentId == agentId }.map { it.id }.toSet()
      if (ids.isNotEmpty()) {
        schedules.removeAll { it.id in ids }
        waiting.removeAll { it.scheduleId in ids }
        save()
      }
      ids.isNotEmpty()
    }
    if (gone) changed()
    return gone
  }

  // ---- firing ---------------------------------------------------------------------

  /** The schedules due now (DueRules), their nextAt moved on already. */
  fun takeDue(): List<DueRules.Due> {
    val due = synchronized(this) {
      val due = DueRules.due(schedules, clock(), zone())
      if (due.isEmpty()) return emptyList()
      val next = due.associate { it.schedule.id to it.nextAt }
      for (i in schedules.indices) {
        val s = schedules[i]
        if (s.id in next) schedules[i] = s.copy(nextAt = next[s.id])
      }
      save()
      due
    }
    changed()
    return due
  }

  /** What [id]'s latest firing came to. */
  fun ran(id: String, run: LastRun) {
    val found = synchronized(this) {
      val i = schedules.indexOfFirst { it.id == id }
      if (i >= 0) {
        schedules[i] = schedules[i].copy(lastRun = run)
        save()
      }
      i >= 0
    }
    if (found) changed()
  }

  /** A firing waits for its agent (one per schedule: a newer one replaces it). */
  fun wait(w: Waiting) {
    synchronized(this) {
      if (schedules.none { it.id == w.scheduleId }) return
      waiting.removeAll { it.scheduleId == w.scheduleId }
      waiting += w
      save()
    }
    changed()
  }

  /** [scheduleId]'s firing no longer waits. */
  fun unwait(scheduleId: String) {
    val gone = synchronized(this) {
      waiting.removeAll { it.scheduleId == scheduleId }.also { if (it) save() }
    }
    if (gone) changed()
  }

  /**
   * The zone or the clock changed: a repeating schedule's next time is
   * worked out again from now. One already due keeps its time, so it runs
   * (late) rather than being skipped.
   */
  fun rezone() {
    val now = clock()
    val moved = synchronized(this) {
      var any = false
      for (i in schedules.indices) {
        val s = schedules[i]
        val at = s.nextAt ?: continue
        if (!s.on || !s.timing.repeats || at <= now) continue
        val next = NextRun.after(s.timing, now, zone())
        if (next != at) {
          schedules[i] = s.copy(nextAt = next)
          any = true
        }
      }
      if (any) save()
      any
    }
    if (moved) changed()
  }

  // ---- inside ------------------------------------------------------------------------

  private fun save() {
    try {
      store.save(ScheduleStore.Saved(schedules.toList(), waiting.toList()))
    } catch (e: Exception) {
      onError("schedules not saved", e)
    }
  }

  private fun changed() {
    try {
      onChange()
    } catch (e: Exception) {
      onError("schedule listener failed", e)
    }
  }

  private fun bad(why: String) = Result.Refused(BAD, why)

  private fun notFound() = Result.Refused(NOT_FOUND, "no schedule with that id")

  companion object {
    const val BAD = "bad_request"
    const val LIMIT = "limit"
    const val NOT_ALLOWED = "not_allowed"
    const val NOT_FOUND = "not_found"

    /** The agent's kind cannot run scheduled tasks. */
    const val UNSUPPORTED = "unsupported"

    /** No such agent (it was deleted). */
    const val AGENT_GONE = "agent_gone"
  }
}
