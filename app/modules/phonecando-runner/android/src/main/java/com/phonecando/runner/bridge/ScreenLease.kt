package com.phonecando.runner.bridge

// One agent at a time drives the screen. The PCE keeps one current snapshot
// per phone, so a second agent's observe invalidates the first one's
// snapshot ids, and a long act holds the PCE lane (up to 120 s) while other
// callers' client timeouts run out. So the first agent to use a screen route
// holds the screen until it has been idle for `idleMs`, counted from the end
// of its last screen request and never while one is still running; the
// others are told who holds it and how long to wait. Its own requests always
// pass, so observe then act (every composed tool) cannot be split by
// another agent. A lease ends early when the holder is gone (`alive` false:
// its engine left the agent directory) or gives the screen back (done with
// release, the holder's /app). Pure: the clock is injected.
class ScreenLease(private val idleMs: Long, private val clock: () -> Long) {
  sealed interface Claim

  /** The caller holds the screen for this request; pass the ticket to [done]. */
  class Granted internal constructor(val ticket: Ticket) : Claim

  /** Another agent holds the screen: name it, and when to try again. */
  data class Busy(val holderName: String, val retryAfterMs: Long) : Claim

  class Ticket internal constructor(val agentId: String, internal val epoch: Long)

  private var holder: String? = null
  private var holderName = ""
  private var running = 0
  private var lastUse = 0L

  // Bumped whenever the screen changes hands, so a request that outlived
  // its lease (holder gone mid-call) cannot touch the next holder's count.
  private var epoch = 0L

  @Synchronized
  fun claim(agentId: String, agentName: String, alive: (agentId: String) -> Boolean): Claim {
    val now = clock()
    val current = holder
    if (current != null && current != agentId) {
      val idle = running == 0 && now - lastUse >= idleMs
      if (!idle && alive(current)) {
        val wait = if (running > 0) idleMs else idleMs - (now - lastUse)
        return Busy(holderName, wait.coerceAtLeast(1))
      }
      holder = null
    }
    if (holder == null) {
      holder = agentId
      running = 0
      epoch++
    }
    holderName = agentName
    running++
    lastUse = now
    return Granted(Ticket(agentId, epoch))
  }

  /** The request [claim] granted has ended; `release` gives the screen back. */
  @Synchronized
  fun done(ticket: Ticket, release: Boolean = false) {
    if (ticket.epoch != epoch || holder != ticket.agentId) return
    running = (running - 1).coerceAtLeast(0)
    lastUse = clock()
    if (release && running == 0) holder = null
  }

  /** The current holder's agent id, idle or not; null when free. */
  @Synchronized
  fun holderId(): String? = holder
}
