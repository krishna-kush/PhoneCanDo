package com.phonecando.runner.cutoff

import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.tui.TuiEvents

// What the record keeps as engines and their chats change (CutOffs feeds
// it from the engines' listener). Pure.
// - A ready engine's runs in this life are its busy chats (ChatBoard): the
//   working ones, else those waiting for your answer (a subagent's chat
//   shows only while it waits, and its parent works then). Each is kept
//   with when it began. Its runs from other lives go: it runs here now.
// - Every SEEN_EVERY_MS (refresh) a run still going takes its agent's last
//   sign of work (seenAt: an activity event, TUI output, what ACP mode
//   last sent) and when it was looked at (checkedAt): a chat left showing
//   working with nothing behind it ages, and the look skips it
//   (CutOffLook.STALE_MS). A board change alone is no sign of work.
// - A stop (yours, the idle stop, the memory guard, a cap, a mode switch,
//   a TUI's own exit 0) ends its runs, unless the stop keeps them (Held):
//   then they stay, marked.
// - Its engine dying on its own keeps its runs, marked: they are offered;
//   unless you typed into its TUI just before (Ctrl+C, /exit): a quit.
// - A new run belongs to a scheduled run: the one still open (an ACP turn
//   it began), else, for the first run of its engine's life, the one that
//   set it working since that life began (a terminal start settles at
//   ready, before its chat moves).
// - A self-update that did not happen drops the runs its stop kept.
// - Dismiss, a bring-back under way and a start that is not one (Home, a
//   schedule, a message) settle what the agent was offered: its runs go.
object CutOffRules {
  /** How often runs still going take their agent's last sign of work (a write each time). */
  const val SEEN_EVERY_MS = 10 * 60_000L

  const val TITLE_MAX = 80

  /** Input this close before a TUI's exit makes the exit yours. */
  const val QUIT_WINDOW_MS = 5_000L

  /** How long before its engine's start a scheduled run may have fired and still be what started it (a start prompt waits as long). */
  const val START_SLACK_MS = 2 * 60_000L

  /** A chat the board shows busy: its id as the record keeps it (chatId) and its title. */
  data class Busy(val chatId: String?, val title: String?, val waiting: Boolean)

  /** A ready engine's busy chats, and the mode it runs in. */
  data class Seen(val agentId: String, val mode: EngineMode, val chats: List<Busy>)

  /**
   * The id the record keeps for a board chat [sessionId]: ACP mode's chat
   * ([acpChat], as the board names its one chat like a TUI's), none for a
   * TUI's one chat (its resume args open it again), else the server's.
   */
  fun chatId(mode: EngineMode, sessionId: String, acpChat: String?): String? = when {
    mode == EngineMode.ACP -> acpChat
    sessionId == TuiEvents.SESSION -> null
    else -> sessionId
  }

  /** The chats that are runs: the working ones, else those waiting for your answer. */
  fun runsOf(chats: List<Busy>): List<Busy> = chats.filter { !it.waiting }.ifEmpty { chats.filter { it.waiting } }

  /** [seen]'s runs now, in [life]; [scheduleRun] names the scheduled run a new one belongs to. Sorted, so equal records compare equal. */
  fun sync(
    runs: List<CutOffRun>,
    seen: Seen,
    life: String,
    boot: Int?,
    now: Long,
    scheduleRun: (String) -> Long?,
  ): List<CutOffRun> {
    val mine = runs.filter { it.agentId == seen.agentId && it.life == life && it.diedAt == null && it.held == null }
    val next = runsOf(seen.chats).distinctBy { it.chatId }.map { b ->
      val title = b.title?.trim()?.takeIf { it.isNotEmpty() }?.take(TITLE_MAX)
      val was = mine.firstOrNull { it.chatId == b.chatId && it.mode == seen.mode }
      if (was == null) {
        CutOffRun(seen.agentId, b.chatId, title, seen.mode, now, now, life, boot, scheduleRun(seen.agentId))
      } else {
        was.copy(title = title ?: was.title)
      }
    }
    return sorted(runs.filter { it.agentId != seen.agentId } + next)
  }

  /**
   * [agentId]'s runs still going in [life], looked at [now]: its last sign
   * of work [lastSign] (null: none known) moves seenAt on, never back.
   */
  fun refresh(runs: List<CutOffRun>, agentId: String, life: String, lastSign: Long?, now: Long): List<CutOffRun> = runs.map {
    if (it.agentId != agentId || it.life != life || it.diedAt != null || it.held != null) {
      it
    } else {
      it.copy(seenAt = maxOf(it.seenAt, lastSign ?: it.seenAt), checkedAt = now)
    }
  }

  /** A stop of [agentId]: its runs end; with [held] they stay, marked. */
  fun stopped(runs: List<CutOffRun>, agentId: String, held: Held?): List<CutOffRun> = if (held == null) {
    settled(runs, agentId)
  } else {
    runs.map { if (it.agentId == agentId && it.held == null && it.diedAt == null) it.copy(held = held) else it }
  }

  /** [agentId]'s engine died on its own at [now]: its runs stay, marked. */
  fun died(runs: List<CutOffRun>, agentId: String, now: Long): List<CutOffRun> =
    runs.map { if (it.agentId == agentId && it.diedAt == null) it.copy(diedAt = now) else it }

  /** You typed into its TUI at [lastInputAt], just before it exited at [exitedAt]: you quit it. */
  fun quitByYou(lastInputAt: Long?, exitedAt: Long): Boolean =
    lastInputAt != null && exitedAt - lastInputAt in 0..QUIT_WINDOW_MS

  /**
   * The scheduled run a new run belongs to: [open] (the agent's run still
   * open), else for the first run of its engine's life what
   * [setWorkingSince] finds from a little before [lifeStartedAt].
   */
  fun scheduleRun(open: Long?, firstOfLife: Boolean, lifeStartedAt: Long?, setWorkingSince: (Long) -> Long?): Long? =
    open ?: if (firstOfLife && lifeStartedAt != null) setWorkingSince(lifeStartedAt - START_SLACK_MS) else null

  /** The stop that kept runs as [held] was not what it meant to be (you cancelled the installer): this life's go. */
  fun unheld(runs: List<CutOffRun>, held: Held, life: String): List<CutOffRun> =
    runs.filterNot { it.life == life && it.held == held }

  /** What [agentId] was offered is settled: its runs go. */
  fun settled(runs: List<CutOffRun>, agentId: String): List<CutOffRun> = runs.filterNot { it.agentId == agentId }

  /** [agentId] was brought back and goes on in [life]: its runs cut off go, those going here stay. */
  fun wentOn(runs: List<CutOffRun>, agentId: String, life: String): List<CutOffRun> =
    runs.filterNot { it.agentId == agentId && (it.life != life || it.diedAt != null || it.held != null) }

  private fun sorted(runs: List<CutOffRun>) = runs.sortedWith(compareBy({ it.agentId }, { it.life }, { it.chatId.orEmpty() }))
}
