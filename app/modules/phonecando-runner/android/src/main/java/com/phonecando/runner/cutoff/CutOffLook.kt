package com.phonecando.runner.cutoff

// The look each process makes once (CutOffs.look), and the offers made
// right away. Pure.
// - Runs another process saw going were cut off with it: the phone
//   restarted (the boot count moved), PhoneCanDo was updated, or Android
//   closed it. Unless you stopped PhoneCanDo yourself (force stop, or a
//   swipe that ended it: its last exit says so), and unless a stop kept
//   them (Held) for a reason of its own.
// - Each agent with such runs gets one offer, why read from its newest.
//   The runs stay on disk until it is brought back, dismissed or settled.
// - Left out, and dropped: an agent that is gone, one that runs here
//   already (it was started again), runs not seen for MAX_AGE_MS (a day,
//   as a scheduled task that late is missed, never run), and stale ones:
//   when this process last looked, its agent had shown no sign of work
//   for STALE_MS (a chat left showing working with no run behind it). That
//   last look stands in for the cut: neither a reboot's boot time (it
//   counts the hours the phone was off) nor the last exit's time (none
//   after a reboot, none before Android 11) says when the run stopped.
// - In this life: an engine that died on its own, and a stop by Android
//   that kept runs (Held.SYSTEM), are offered at once (offerNow).
object CutOffLook {
  const val MAX_AGE_MS = 24 * 60 * 60_000L

  /** A run whose agent showed no sign of work this long before the last look is stale, never offered. */
  const val STALE_MS = 60 * 60_000L

  /** What made the process that looks: a boot, an update of the app, or anything else (the app, the service, a tap). */
  enum class Trigger { BOOT, UPDATE, START }

  /** How our last process ended (ApplicationExitInfo): you stopped it, an update, anything else, not known. */
  enum class Exit { USER, UPDATED, OTHER, UNKNOWN }

  enum class Why(val wire: String) {
    REBOOT("reboot"),
    UPDATE("update"),
    CLOSED("closed"),
    DIED("died"),
    ;

    companion object {
      fun of(wire: String?): Why? = values().firstOrNull { it.wire == wire }
    }
  }

  data class Offer(val agentId: String, val runs: List<CutOffRun>, val why: Why)

  /** The runs to keep, and what to offer. */
  data class Result(val runs: List<CutOffRun>, val offers: List<Offer>)

  /** Why [run], seen by an earlier process, stopped; null: you stopped it (no offer). */
  fun why(run: CutOffRun, bootNow: Int?, trigger: Trigger, exit: Exit): Why? {
    val updated = trigger == Trigger.UPDATE || exit == Exit.UPDATED
    return when {
      run.diedAt != null -> Why.DIED
      run.boot != null && bootNow != null && run.boot != bootNow -> Why.REBOOT
      run.held == Held.UPDATE -> if (updated) Why.UPDATE else Why.CLOSED
      run.held == Held.SYSTEM -> Why.CLOSED
      updated -> Why.UPDATE
      exit == Exit.USER -> null
      else -> Why.CLOSED
    }
  }

  /** The look of the process [life] at [now]: [exists] the agent is still there, [live] its engine runs here already. */
  fun look(
    runs: List<CutOffRun>,
    life: String,
    now: Long,
    bootNow: Int?,
    trigger: Trigger,
    exit: Exit,
    exists: (String) -> Boolean,
    live: (String) -> Boolean,
  ): Result {
    val kept = ArrayList<CutOffRun>()
    val cut = ArrayList<Pair<CutOffRun, Why>>()
    for (run in runs) {
      if (run.life == life) {
        kept += run
        continue
      }
      val why = why(run, bootNow, trigger, exit) ?: continue
      if (now - lastSeen(run) > MAX_AGE_MS || stale(run) || !exists(run.agentId) || live(run.agentId)) continue
      kept += run
      cut += run to why
    }
    val offers = cut.groupBy { it.first.agentId }.map { (agentId, list) ->
      Offer(agentId, list.map { it.first }, list.maxByOrNull { lastSeen(it.first) }!!.second)
    }
    return Result(kept, offers)
  }

  /** The offer for [agentId]'s runs of this life that died with its engine or outlived Android's stop; null for none. */
  fun offerNow(runs: List<CutOffRun>, agentId: String, life: String): Offer? {
    val mine = runs.filter { it.agentId == agentId && it.life == life && (it.diedAt != null || it.held == Held.SYSTEM) && !stale(it) }
    if (mine.isEmpty()) return null
    return Offer(agentId, mine, if (mine.any { it.diedAt != null }) Why.DIED else Why.CLOSED)
  }

  /** When it was last looked at, its agent had shown no sign of work for STALE_MS. */
  fun stale(run: CutOffRun): Boolean = run.checkedAt - run.seenAt > STALE_MS

  private fun lastSeen(run: CutOffRun) = maxOf(run.seenAt, run.diedAt ?: 0L)
}
