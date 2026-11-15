package com.phonecando.runner.notify

// The service notification's one line while agents' engines run and
// nothing else lists (no chat, job or model at work, nothing starting or
// stopping): "Claude Code, opencode ready". It keeps the service in the
// foreground, so Android does not stop it, and the agents with it, before
// the idle stop would. The lock screen gets the count only, "2 agents
// ready". Pure.
internal object ReadyLines {
  /** "opencode ready", "Claude Code, opencode ready", "a, b, c and 2 more ready". */
  fun of(names: List<String>): String {
    val shown = names.take(MAX_NAMES).joinToString(", ")
    val more = names.size - MAX_NAMES
    return if (more > 0) "$shown and $more more ready" else "$shown ready"
  }

  /** "1 agent ready": no names, so the lock screen may show it. */
  fun count(agents: Int): String = if (agents == 1) "1 agent ready" else "$agents agents ready"

  private const val MAX_NAMES = 3
}
