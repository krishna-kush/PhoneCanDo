package com.phonecando.runner.notify

// One notification per agent at work under the service's (ServicePlan),
// titled with its name, a tap landing on its Home: its chats, one line
// each ("Fix the login · Working", ChatBoard), then its WorkLines line,
// then its jobs being stopped ("Stopping npm run dev…") and "Starting"
// while its engine starts. An agent being stopped says only "Stopping…".
// Either stop runs a bar that only runs, so a stop that takes a few seconds
// never looks hung. Stop buttons, from its WorkLines line only: each of its
// jobs alone, then the agent with all of it, MAX_STOPS at most (Android
// shows no more). The lock screen gets no names or titles: "1 working",
// "starting", "at work". Agents are listed in the order they first
// appear in the chats, the work lines, the starts, the stops. Pure.
internal object AgentItems {
  /** A job of [agentId]'s being stopped from its notification. */
  data class EndingJob(val agentId: String, val name: String)

  /**
   * [names]: agent id → name; [work]: WorkLines of the agents kept up;
   * [starting]: the agents whose engines start; [stopping]: the agents a
   * Stop was asked of whose engines still run; [ending]: the jobs being
   * stopped.
   */
  fun of(
    chats: List<ChatBoard.Chat>,
    names: Map<String, String>,
    work: List<WorkLines.Line> = emptyList(),
    starting: Collection<String> = emptyList(),
    stopping: Collection<String> = emptyList(),
    ending: List<EndingJob> = emptyList(),
  ): List<ServiceItem> {
    val agents = (chats.map { it.agentId } + work.map { it.agentId } + starting + stopping + ending.map { it.agentId }).distinct()
    return agents.map { id ->
      val name = names[id] ?: id
      val target = LaunchTarget(LaunchTarget.HOME, id)
      if (id in stopping) return@map ServiceItem(key(id), name, listOf(STOPPING), PUBLIC_STOPPING, target, ServiceItem.Bar(null))
      val own = chats.filter { it.agentId == id }
      val line = work.firstOrNull { it.agentId == id }
      val ends = ending.filter { it.agentId == id }
      val lines = own.map { "${it.title ?: NEW_CHAT} · ${it.state.label}" } + listOfNotNull(line?.text) +
        ends.map { "Stopping ${it.name}…" } + listOfNotNull(STARTING.takeIf { id in starting })
      val stops = line?.let { l -> l.jobs.map { ServiceItem.Stop("Stop ${it.name}", id, it) } + ServiceItem.Stop("Stop $name", id) }.orEmpty()
      ServiceItem(
        key(id), name, lines, publicText(own, id in starting), target,
        ServiceItem.Bar(null).takeIf { ends.isNotEmpty() }, stops.take(MAX_STOPS),
      )
    }
  }

  /** "1 waiting for your answer · 2 working", in the board's state order; no titles. */
  fun chatCounts(chats: List<ChatBoard.Chat>): String =
    ChatBoard.State.entries.mapNotNull { state ->
      val n = chats.count { it.state == state }
      if (n == 0) null else "$n ${state.label.lowercase()}"
    }.joinToString(" · ")

  private fun publicText(chats: List<ChatBoard.Chat>, starting: Boolean): String =
    chatCounts(chats).ifEmpty { if (starting) STARTING_PUBLIC else AT_WORK }

  private fun key(agentId: String) = "agent:$agentId"

  private const val NEW_CHAT = "New chat"
  private const val STARTING = "Starting"
  private const val STOPPING = "Stopping…"
  private const val AT_WORK = "at work"
  private const val STARTING_PUBLIC = "starting"
  private const val PUBLIC_STOPPING = "stopping"

  // Android shows three actions at most.
  private const val MAX_STOPS = 3
}
