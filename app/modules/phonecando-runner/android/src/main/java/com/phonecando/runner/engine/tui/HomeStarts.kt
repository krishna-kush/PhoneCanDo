package com.phonecando.runner.engine.tui

import java.util.concurrent.ConcurrentHashMap

// Terminal starts the app asked for (startEngine in terminal mode: Home
// opening the agent's TUI, or the app coming to the front on it). Until a
// view attaches to that terminal, EngineTerminal.hasViewer says nobody
// watches, yet Home is about to show it: the agent counts as watched from
// the ask until a view attaches (hasViewer says from then on), at most
// MAX_AGE_MS, so a queued message never switches it to ACP mode under a
// Home that is still opening (messages/ LiveAgentsView, AcpRoute).
// Thread-safe.
object HomeStarts {
  /** How long an ask counts while no view attaches (a start can take a while; Home may have moved on). */
  const val MAX_AGE_MS = 2 * 60_000L

  private val asks = ConcurrentHashMap<String, Long>()

  /** Clock for the age, in ms; monotonic. */
  internal var now: () -> Long = { System.nanoTime() / 1_000_000 }

  /** The app asked for [agentId]'s terminal. */
  fun asked(agentId: String) {
    asks[agentId] = now()
  }

  /** A view attached to [agentId]'s terminal: hasViewer says from now on. */
  fun attached(agentId: String) {
    asks.remove(agentId)
  }

  /** Whether the app asked for [agentId]'s terminal under MAX_AGE_MS ago and no view attached since. */
  fun pending(agentId: String): Boolean {
    val at = asks[agentId] ?: return false
    if (now() - at <= MAX_AGE_MS) return true
    asks.remove(agentId, at)
    return false
  }
}
