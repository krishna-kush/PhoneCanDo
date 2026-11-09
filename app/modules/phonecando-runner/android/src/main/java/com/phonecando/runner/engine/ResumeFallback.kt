package com.phonecando.runner.engine

import com.phonecando.agents.kit.manifest.EngineStyle

// A TUI engine launched with its kind's resume args (engine.resume: the
// agent ran before) that dies before it is ready may have had nothing to
// resume (`claude --continue` in a folder without a chat exits 1), so the
// supervisor launches it once more without them, as the same start. A
// launch without them never falls back. Pure.
internal object ResumeFallback {
  /** Whether [plan]'s engine, which exited with [status] before it was ready, gets that launch. */
  fun applies(plan: LaunchPlan, status: Int): Boolean =
    plan.resume && status != 0 && plan.kind.style == EngineStyle.TUI && plan.kind.manifest.engine?.resume != null

  /** The plan for that launch. */
  fun without(plan: LaunchPlan): LaunchPlan = plan.copy(resume = false)
}
