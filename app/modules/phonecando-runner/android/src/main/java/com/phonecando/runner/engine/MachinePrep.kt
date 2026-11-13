package com.phonecando.runner.engine

import java.util.concurrent.ConcurrentHashMap

// A start with no app around (a scheduled task) readies the agent's machine
// itself: the app does that before each of its own starts
// (prepareImageForStart), rewriting what depends on the phone and on this
// install (the shims point into the APK's lib folder, which moves on every
// update; launch.conf, engine.env, DNS). Whoever starts an engine natively
// marks the agent here; EngineLauncher.plan() takes the mark and readies the
// machine first. A mark left untaken longer than MAX_AGE_MS (the start
// never came) is dropped on take. Thread-safe.
object MachinePrep {
  /** How long a mark waits for its start. */
  const val MAX_AGE_MS = 2 * 60_000L

  private val marks = ConcurrentHashMap<String, Long>()

  /** Clock for the age, in ms; monotonic. */
  internal var now: () -> Long = { System.nanoTime() / 1_000_000 }

  fun mark(agentId: String) {
    marks[agentId] = now()
  }

  /** Whether [agentId]'s next start readies its machine first; the mark is removed. */
  fun take(agentId: String): Boolean {
    val at = marks.remove(agentId) ?: return false
    return now() - at <= MAX_AGE_MS
  }
}
