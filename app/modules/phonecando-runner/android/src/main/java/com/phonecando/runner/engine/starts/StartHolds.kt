package com.phonecando.runner.engine.starts

import com.phonecando.runner.engine.EngineState
import java.util.concurrent.ConcurrentHashMap

// The agents whose start, asked for with nobody in the app (a scheduled
// task, a message), failed lately, or whose ACP turn went silent so we
// stopped it (AcpTurnWatch), and why. For HOLD_MS after that failure
// nothing of ours starts the agent again by itself: a start that just
// failed (not installed, a sign-in, a crash) would most likely fail the
// same way. Android refusing the request is no failed start, and a start
// you make in the app is never held. Any start that comes up (its engine
// ready, however it was started) ends the hold (Engines tells statusChanged).
// One per process (shared); the clock is injected for tests.
class StartHolds(private val clock: () -> Long = System::currentTimeMillis) {
  private val failures = ConcurrentHashMap<String, Pair<Long, String>>()

  /** [agentId]'s start failed now; [why] says so in plain words ("not ready after 120 s"). */
  fun failed(agentId: String, why: String) {
    failures[agentId] = clock() to why
  }

  /** Why [agentId]'s last start failed, while that was under HOLD_MS ago; null when it is not held. */
  fun why(agentId: String): String? {
    val (at, why) = failures[agentId] ?: return null
    if (clock() - at < HOLD_MS) return why
    failures.remove(agentId, at to why)
    return null
  }

  /** The agent is deleted, or started fine. */
  fun forget(agentId: String) {
    failures.remove(agentId)
  }

  /** [agentId]'s engine is now [state]: ready, it started fine. */
  fun statusChanged(agentId: String, state: EngineState) {
    if (state == EngineState.READY) forget(agentId)
  }

  companion object {
    /** How long a failed start holds the agent back. */
    const val HOLD_MS = 10 * 60_000L

    /** The process's one. */
    val shared = StartHolds()
  }
}
