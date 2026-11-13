package com.phonecando.runner.engine.ready

import com.phonecando.agents.kit.render.TuiReadiness

// A TUI engine is ready by its kind's `engine.readiness`: after its first
// output and then settleMs of quiet (OutputReady), or once it has run a
// while (AliveReady). One started with a first prompt (a scheduled task)
// works from its first frame and may never go quiet while a slow model
// answers, so output and settleMs since the spawn are enough (PromptedReady).
// Either way it must be running; EngineWatch checks that first. Pure: epoch
// ms from [now].
internal class OutputReady(
  private val lastOutputAt: () -> Long?,
  private val settleMs: Long,
  override val timeoutMs: Long,
  private val now: () -> Long = System::currentTimeMillis,
) : ReadyProbe {
  override val intervalMs: Long = TuiReady.INTERVAL_MS

  override fun check(): ReadyProbe.Verdict {
    val last = lastOutputAt() ?: return ReadyProbe.Verdict.WAIT
    return if (now() - last >= settleMs) ReadyProbe.Verdict.READY else ReadyProbe.Verdict.WAIT
  }
}

internal class PromptedReady(
  private val lastOutputAt: () -> Long?,
  private val startedAt: Long,
  private val settleMs: Long,
  override val timeoutMs: Long,
  private val now: () -> Long = System::currentTimeMillis,
) : ReadyProbe {
  override val intervalMs: Long = TuiReady.INTERVAL_MS

  override fun check(): ReadyProbe.Verdict =
    if (lastOutputAt() != null && now() - startedAt >= settleMs) ReadyProbe.Verdict.READY else ReadyProbe.Verdict.WAIT
}

internal class AliveReady(
  private val startedAt: Long,
  private val ms: Long,
  private val now: () -> Long = System::currentTimeMillis,
) : ReadyProbe {
  // Alive is all it takes, so only a program that ends can fail the start.
  override val timeoutMs: Long = Long.MAX_VALUE
  override val intervalMs: Long = TuiReady.INTERVAL_MS

  override fun check(): ReadyProbe.Verdict =
    if (now() - startedAt >= ms) ReadyProbe.Verdict.READY else ReadyProbe.Verdict.WAIT
}

internal object TuiReady {
  const val INTERVAL_MS = 100L

  /** [startedAt]: epoch ms of the spawn; [prompted]: it was started with a first prompt. */
  fun of(readiness: TuiReadiness, lastOutputAt: () -> Long?, startedAt: Long, prompted: Boolean = false): ReadyProbe = when (readiness) {
    is TuiReadiness.Output ->
      if (prompted) {
        PromptedReady(lastOutputAt, startedAt, readiness.settleMs, readiness.timeoutMs)
      } else {
        OutputReady(lastOutputAt, readiness.settleMs, readiness.timeoutMs)
      }
    is TuiReadiness.Alive -> AliveReady(startedAt, readiness.ms)
  }
}
