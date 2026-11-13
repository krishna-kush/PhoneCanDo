package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.WorkWatch

// The service notification's lines for the agents that stay up between
// chats: one that left a job running or is starting one ("Claude Code ·
// running npm run dev"), that the user keeps running ("Claude Code · kept
// running"), that asked to stay up ("Claude Code · kept running: waiting
// for Tester's answer (until 14:30)") or whose kind tells no chats and is
// not idle ("Cline · active"). An agent with a chat working has its
// chat's line instead. Each line gets a Stop for each of its [Line.jobs]
// (that job alone) and one for the agent and all its jobs
// (ServiceNotification). A job being stopped is off its line at once.
// Pure.
internal object WorkLines {
  data class Line(val agentId: String, val name: String, val text: String, val jobs: List<WorkWatch.Job> = emptyList())

  /**
   * [working]: agents with a chat working; [names]: agent id → name;
   * [ending]: the root pids of the jobs being stopped; [time]: epoch ms as
   * the phone shows a time.
   */
  fun of(
    states: Collection<WorkWatch.State>,
    working: Set<String>,
    names: Map<String, String>,
    ending: Set<Int> = emptySet(),
    time: (Long) -> String,
  ): List<Line> =
    states.filter { it.agentId !in working }.mapNotNull { s ->
      val refs = s.refs.filter { it.pid !in ending }
      val running = if (s.refs.isEmpty()) s.jobs else refs.map { it.name }.distinct()
      if (running.isEmpty() && !s.held && s.starting.isEmpty() && !s.printing) return@mapNotNull null
      val name = names[s.agentId] ?: s.agentId
      val ask = s.ask
      val text = when {
        running.isNotEmpty() || s.starting.isNotEmpty() -> "running ${jobs((running + s.starting).distinct())}"
        s.kept -> "kept running"
        ask != null -> "kept running: ${ask.reason} (until ${time(ask.until)})"
        else -> "active"
      }
      Line(s.agentId, name, "$name · $text", refs)
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
