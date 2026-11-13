package com.phonecando.runner.engine

import com.phonecando.agents.kit.manifest.EngineStyle

// A TUI engine launched with its kind's resume args (engine.resume: the
// agent ran before) that dies before it is ready may have had nothing to
// resume (`claude --continue` in a folder without a chat exits 1), so the
// supervisor launches it once more without them, as the same start. The
// same goes for one that dies after it is ready but before it raised any
// event: a first-run screen (Claude Code's theme and security notes) makes
// it ready, and only then does its resume find nothing. A launch without
// them never falls back. The launch again keeps the first prompt (a
// scheduled task), so the task still runs, in a new chat. Pure.
internal object ResumeFallback {
  /** Whether [plan]'s engine, which exited with [status] before it was ready, gets that launch. */
  fun applies(plan: LaunchPlan, status: Int): Boolean =
    plan.resume && status != 0 && plan.kind.style == EngineStyle.TUI && plan.kind.manifest.engine?.resume != null

  /** The same for an exit after it was ready; [sawEvent]: it raised an engine event in this life. */
  fun appliesAfterReady(plan: LaunchPlan, status: Int, sawEvent: Boolean): Boolean = !sawEvent && applies(plan, status)

  /** The plan for that launch: the same, its prompt too, without the resume args. */
  fun without(plan: LaunchPlan): LaunchPlan = plan.copy(resume = false)
}
