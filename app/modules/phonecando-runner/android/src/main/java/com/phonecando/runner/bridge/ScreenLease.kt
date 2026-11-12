package com.phonecando.runner.bridge

// One agent at a time drives the screen. The PCE keeps one current snapshot
// per phone, so a second agent's observe invalidates the first one's
// snapshot ids, and a long act holds the PCE lane (up to 120 s) while other
// callers' client timeouts run out. So the first agent to use a screen route
// holds the screen until it has been idle for `idleMs`, counted from the end
// of its last screen request and never while one is still running. Its own
// requests always pass, so observe then act (every composed tool) cannot be
// split by another agent.
//
// The others wait in line, first come first served: an agent joins once
// (the holder is told, ScreenNotices.waiting) and learns its place. When the
// holder's lease ends (it gives the screen back: done with release, the
// holder's /app; it has been idle `idleMs` while someone waits; its engine
// is gone: `alive` false or forget), the screen is reserved for the first in
// line for `idleMs` (ScreenNotices.yours): only that agent's claim takes it,
// and if it does not come, the next in line gets the reservation. An idle
// holder with nobody in line keeps the screen until someone claims it.
//
// An agent's unlock dialog (promptOpened/promptClosed) stops its time: a
// holder's idle time or a reservation does not run out while the user
// decides, and a free screen is reserved for the asking agent so nobody
// drives over the dialog. After a yes its time starts over; after a no or
// no answer the screen passes on at once.
//
// A turn another agent's message started (`agentTurn`) never takes a free
// screen and never joins the line: it gets the screen only when the line
// hands it over (its reservation, or a lease that began with one).
//
// Time moves on at every call and at tick (the bridge ticks every second),
// so a waiter hears it is theirs even when nobody calls. Pure: the clock is
// injected, and notices go out after the lock is let go.
class ScreenLease(
  private val idleMs: Long,
  private val notices: ScreenNotices = ScreenNotices.NONE,
  private val clock: () -> Long,
) {
  sealed interface Claim

  /** The caller holds the screen for this request; pass the ticket to [done]. */
  class Granted internal constructor(val ticket: Ticket) : Claim

  /** Another agent has the screen: its name, when to try again, and the caller's place in line (1-based). */
  data class Busy(val holderName: String, val retryAfterMs: Long, val place: Int = 1) : Claim

  /** A turn another agent's message started cannot take the screen. */
  data object Refused : Claim

  class Ticket internal constructor(val agentId: String, internal val epoch: Long)

  data class Seat(val agentId: String, val name: String)

  /** Who has the screen (`reserved`: kept for it, not claimed yet) and who waits, in order. */
  data class Line(val holder: Seat?, val reserved: Boolean, val waiting: List<Seat>)

  private val mutex = Any()

  private var holder: String? = null
  private var holderName = ""
  private var running = 0

  // The end of the holder's last screen request (inUse), and where its idle
  // time counts from: that, or the end of its last unlock dialog.
  private var lastUse = 0L
  private var idleFrom = 0L

  // The holder's lease began with a reservation the line handed over.
  private var fromLine = false

  // Bumped whenever the screen changes hands, so a request that outlived
  // its lease (holder gone mid-call) cannot touch the next holder's count.
  private var epoch = 0L

  private var reserved: String? = null
  private var reservedName = ""
  private var reservedUntil = 0L
  private var reservedFromLine = false

  // The agent whose unlock dialog is open (how many): its time stands still.
  private var prompting: String? = null
  private var prompts = 0

  // The agents waiting, in order: id to name.
  private val waiting = LinkedHashMap<String, String>()

  /**
   * A screen request: Granted for the holder, the reserved agent or a free
   * screen; otherwise the caller joins the line (Busy with its place), or
   * is Refused when [agentTurn] and the line did not hand it the screen.
   */
  fun claim(
    agentId: String,
    agentName: String,
    alive: (agentId: String) -> Boolean,
    agentTurn: Boolean = false,
  ): Claim = locked { out ->
    val now = clock()
    settle(now, alive, out)
    when {
      holder == agentId -> if (agentTurn && !fromLine) Refused else use(agentId, agentName, now)
      reserved == agentId -> {
        hold(agentId, fromLine = reservedFromLine)
        use(agentId, agentName, now)
      }
      agentTurn -> placeOf(agentId, now) ?: Refused
      free(now) -> {
        hold(agentId, fromLine = false)
        use(agentId, agentName, now)
      }
      else -> join(agentId, agentName, now, out)
    }
  }

  /**
   * A locked agent asked for the screen: while another agent has it, the
   * caller waits in line (Busy, or Refused when [agentTurn]); null when the
   * screen is free or its own. Never a ticket: only an unlocked agent drives.
   */
  fun waitInLine(
    agentId: String,
    agentName: String,
    alive: (agentId: String) -> Boolean,
    agentTurn: Boolean = false,
  ): Claim? = locked { out ->
    val now = clock()
    settle(now, alive, out)
    when {
      holder == agentId || reserved == agentId || free(now) -> null
      agentTurn -> placeOf(agentId, now) ?: Refused
      else -> join(agentId, agentName, now, out)
    }
  }

  /**
   * The agent is about to show its unlock dialog: null lets it, with its
   * time stopped until [promptClosed] (a free screen is reserved for it,
   * unless [agentTurn]). While another agent has the screen the caller
   * waits in line instead (Busy, or Refused when [agentTurn]).
   */
  fun promptOpened(
    agentId: String,
    agentName: String,
    alive: (agentId: String) -> Boolean,
    agentTurn: Boolean = false,
  ): Claim? = locked { out ->
    val now = clock()
    settle(now, alive, out)
    when {
      holder == agentId || reserved == agentId -> {
        pause(agentId)
        null
      }
      free(now) -> {
        if (!agentTurn) {
          if (holder != null) endHolder()
          reserve(agentId, agentName, now, fromLine = false)
          pause(agentId)
        }
        null
      }
      agentTurn -> placeOf(agentId, now) ?: Refused
      else -> join(agentId, agentName, now, out)
    }
  }

  /** The dialog [promptOpened] let through closed: `keep` (unlocked now) starts its time over, else the screen passes on. */
  fun promptClosed(agentId: String, keep: Boolean): Unit = locked { out ->
    if (prompting != agentId || prompts == 0) return@locked
    if (--prompts > 0) return@locked
    prompting = null
    val now = clock()
    when (agentId) {
      holder -> if (keep) idleFrom = now else if (running == 0) endHolder()
      reserved -> if (keep) reservedUntil = now + idleMs else reserved = null
    }
    settle(now, null, out)
  }

  /** The request [claim] granted has ended; `release` gives the screen back. */
  fun done(ticket: Ticket, release: Boolean = false): Unit = locked { out ->
    if (ticket.epoch != epoch || holder != ticket.agentId) return@locked
    val now = clock()
    running = (running - 1).coerceAtLeast(0)
    lastUse = now
    idleFrom = now
    if (release && running == 0) {
      endHolder()
      settle(now, null, out)
    }
  }

  /** The agent's engine is gone: it leaves the line and loses the screen or its reservation at once. */
  fun forget(agentId: String): Unit = locked { out ->
    waiting.remove(agentId)
    if (reserved == agentId) reserved = null
    if (holder == agentId) endHolder()
    settle(clock(), null, out)
  }

  /** Lets time move the line on: an idle holder or an unclaimed reservation passes the screen. */
  fun tick(alive: (agentId: String) -> Boolean): Unit = locked { out -> settle(clock(), alive, out) }

  /** The current holder's agent id, idle or not; null when free or only reserved. */
  fun holderId(): String? = synchronized(mutex) { holder }

  /** A holder is driving: a screen request runs or one ended under `idleMs` ago. A reservation is not. */
  fun inUse(): Boolean = synchronized(mutex) { holder != null && (running > 0 || clock() - lastUse < idleMs) }

  /** Who has the screen and who waits, as of the last call or tick. An idle holder nobody waits for is not shown. */
  fun line(): Line = synchronized(mutex) {
    val now = clock()
    val held = holder?.takeUnless { holderIdle(now) }
    val seat = when {
      reserved != null -> Seat(reserved!!, reservedName)
      held != null -> Seat(held, holderName)
      else -> null
    }
    Line(seat, reserved = reserved != null, waiting = waiting.map { Seat(it.key, it.value) })
  }

  // Ends what time or a gone engine has ended, then reserves a free screen
  // for the first in line. `alive` is null where no check is at hand.
  private fun settle(now: Long, alive: ((String) -> Boolean)?, out: MutableList<() -> Unit>) {
    if (alive != null) {
      waiting.keys.removeAll { !alive(it) }
      if (holder?.let(alive) == false) endHolder()
      if (reserved?.let(alive) == false) reserved = null
    }
    if (holder != null && waiting.isNotEmpty() && holderIdle(now)) endHolder()
    if (reserved != null && !paused(reserved) && now >= reservedUntil) reserved = null
    if (holder != null || reserved != null) return
    val next = waiting.entries.firstOrNull() ?: return
    waiting.remove(next.key)
    reserve(next.key, next.value, now, fromLine = true)
    out += { notices.yours(next.key) }
  }

  private fun free(now: Long) = reserved == null && (holder == null || holderIdle(now))

  private fun holderIdle(now: Long) = running == 0 && !paused(holder) && now - idleFrom >= idleMs

  private fun paused(agentId: String?) = agentId != null && prompting == agentId && prompts > 0

  private fun hold(agentId: String, fromLine: Boolean) {
    holder = agentId
    running = 0
    epoch++
    this.fromLine = fromLine
    if (reserved == agentId) reserved = null
    waiting.remove(agentId)
  }

  private fun use(agentId: String, agentName: String, now: Long): Granted {
    holderName = agentName
    running++
    lastUse = now
    idleFrom = now
    return Granted(Ticket(agentId, epoch))
  }

  private fun endHolder() {
    holder = null
    running = 0
    fromLine = false
  }

  private fun reserve(agentId: String, agentName: String, now: Long, fromLine: Boolean) {
    reserved = agentId
    reservedName = agentName
    reservedUntil = now + idleMs
    reservedFromLine = fromLine
  }

  private fun pause(agentId: String) {
    if (prompting != agentId) {
      prompting = agentId
      prompts = 0
    }
    prompts++
  }

  private fun join(agentId: String, agentName: String, now: Long, out: MutableList<() -> Unit>): Busy {
    if (agentId !in waiting) {
      waiting[agentId] = agentName
      val owner = holder ?: reserved
      if (owner != null) out += { notices.waiting(owner, agentName) }
    }
    return busy(agentId, now)
  }

  private fun placeOf(agentId: String, now: Long): Busy? = if (agentId in waiting) busy(agentId, now) else null

  // Whoever has the screen (it is never free while someone waits), and how
  // long until its time could run out.
  private fun busy(agentId: String, now: Long): Busy {
    val place = waiting.keys.indexOf(agentId) + 1
    val wait = when {
      holder != null -> if (running > 0 || paused(holder)) idleMs else idleMs - (now - idleFrom)
      paused(reserved) -> idleMs
      else -> reservedUntil - now
    }
    val name = if (holder != null) holderName else reservedName
    return Busy(name, wait.coerceAtLeast(1), place)
  }

  // Runs [block] under the lock, then sends the notices it queued; a notice
  // that fails never undoes the lease's step.
  private inline fun <T> locked(block: (out: MutableList<() -> Unit>) -> T): T {
    val out = mutableListOf<() -> Unit>()
    val result = synchronized(mutex) { block(out) }
    for (notice in out) runCatching { notice() }
    return result
  }
}
