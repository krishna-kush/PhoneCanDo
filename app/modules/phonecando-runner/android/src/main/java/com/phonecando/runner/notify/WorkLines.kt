package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.WorkWatch

// The service notification's lines for the agents that stay up between
// chats: one that left a job running ("Claude Code · running npm run dev")
// or that the user keeps running ("Claude Code · kept running"). An agent
// with a chat working has its chat's line instead. Each line gets a Stop
// (ServiceNotification), which ends the agent and its jobs. Pure.
internal object WorkLines {
  data class Line(val agentId: String, val name: String, val text: String)

  /** [working]: agents with a chat working; [names]: agent id → name. */
  fun of(states: Collection<WorkWatch.State>, working: Set<String>, names: Map<String, String>): List<Line> =
    states.filter { (it.busy || it.kept) && it.agentId !in working }.map { s ->
      val name = names[s.agentId] ?: s.agentId
      Line(s.agentId, name, "$name · " + if (s.busy) "running ${jobs(s.jobs)}" else "kept running")
    }

  /** "a", "a, b", "a, b +2 more". */
  fun jobs(jobs: List<String>): String {
    val shown = jobs.take(MAX_JOBS).joinToString(", ")
    return if (jobs.size > MAX_JOBS) "$shown +${jobs.size - MAX_JOBS} more" else shown
  }

  /** "1 agent kept running": no names, so the lock screen may show it. */
  fun count(lines: List<Line>): String = when (lines.size) {
    0 -> ""
    1 -> "1 agent kept running"
    else -> "${lines.size} agents kept running"
  }

  private const val MAX_JOBS = 2
}
