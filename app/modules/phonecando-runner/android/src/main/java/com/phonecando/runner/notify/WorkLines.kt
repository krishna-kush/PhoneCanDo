package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.WorkWatch

// The service notification's lines for the agents that stay up between
// chats: one that left a job running or is starting one ("Claude Code ·
// running npm run dev"), that the user keeps running ("Claude Code · kept
// running"), that asked to stay up ("Claude Code · kept running: waiting
// for Tester's answer (until 14:30)") or whose kind tells no chats and is
// not idle ("Cline · active"). An agent with a chat working has its
// chat's line instead. Each line gets a Stop (ServiceNotification), which
// ends the agent and its jobs. Pure.
internal object WorkLines {
  data class Line(val agentId: String, val name: String, val text: String)

  /** [working]: agents with a chat working; [names]: agent id → name; [time]: epoch ms as the phone shows a time. */
  fun of(
    states: Collection<WorkWatch.State>,
    working: Set<String>,
    names: Map<String, String>,
    time: (Long) -> String,
  ): List<Line> =
    states.filter { (it.busy || it.held || it.starting.isNotEmpty() || it.printing) && it.agentId !in working }.map { s ->
      val name = names[s.agentId] ?: s.agentId
      val ask = s.ask
      val text = when {
        s.busy || s.starting.isNotEmpty() -> "running ${jobs((s.jobs + s.starting).distinct())}"
        s.kept -> "kept running"
        ask != null -> "kept running: ${ask.reason} (until ${time(ask.until)})"
        else -> "active"
      }
      Line(s.agentId, name, "$name · $text")
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
