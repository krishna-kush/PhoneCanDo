package com.phonecando.runner.notify

// What the service's notifications show: the service's own one (Android
// wants one while it is in the foreground) and, under it, one notification
// per thing at work, each with its own tap ([Plan.items]: the agents',
// AgentItems, then the jobs', JobLines and ReadingLines). With items, the
// service's one heads them as a bundle ([Summary.group]) and counts them:
// "1 waiting for your answer · 2 jobs running". With none, it is the one
// quiet line of the engines that only run ("Claude Code, opencode ready",
// ReadyLines): away from the app, Android stops a service out of the
// foreground about a minute later, and the agents with it. With the app on
// screen that line is not needed, so there is none: the app shows its
// agents. Only then, or with nothing running at all, is there no summary
// and the service leaves the foreground. Names and titles stay off the lock
// screen: [Summary.publicText] only counts. Pure.
internal object ServicePlan {
  /** The service's own notification; [target]: where its tap lands (ServiceTap), null for the app as it was. */
  data class Summary(val text: String, val publicText: String, val target: LaunchTarget?, val group: Boolean)

  data class Plan(val summary: Summary?, val items: List<ServiceItem>)

  /**
   * [agents]: AgentItems; [jobs]: the jobs' items; [chats]: the chats the
   * agents' items list; [running]: agents whose engine is live; [names]:
   * agent id → name; [onScreen]: the app is in front.
   */
  fun of(
    agents: List<ServiceItem>,
    jobs: List<ServiceItem>,
    chats: List<ChatBoard.Chat>,
    running: List<String>,
    names: Map<String, String>,
    onScreen: Boolean,
  ): Plan {
    val items = agents + jobs
    if (items.isEmpty()) {
      if (running.isEmpty() || onScreen) return Plan(null, emptyList())
      val ready = running.map { names[it] ?: it }
      return Plan(Summary(ReadyLines.of(ready), ReadyLines.count(ready.size), ServiceTap.of(emptyList(), emptyList(), running), false), items)
    }
    val busy = agents.size - chats.map { it.agentId }.distinct().size
    val counts = listOf(AgentItems.chatCounts(chats), busyCount(busy), jobCount(jobs.size)).filter { it.isNotEmpty() }.joinToString(" · ")
    val target = ServiceTap.of(chats.map { it.agentId }, items.mapNotNull { it.target }, running)
    return Plan(Summary(counts, counts, target, true), items)
  }

  // "1 agent at work": the agents with no chat listed (kept up, starting, stopping).
  private fun busyCount(n: Int): String = when {
    n <= 0 -> ""
    n == 1 -> "1 agent at work"
    else -> "$n agents at work"
  }

  private fun jobCount(n: Int): String = when (n) {
    0 -> ""
    1 -> "1 job running"
    else -> "$n jobs running"
  }
}
