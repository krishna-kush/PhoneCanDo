package com.phonecando.runner.notify

// Where a tap on the service notification lands: on what it lists. A chat
// lands on its agent's Home; the service gives the place of every other
// line ([places]: an agent kept up, starting or stopping, its Home; an
// agent's install or its machine's setup, the agent's page with its bar; a
// system's download, Systems; a model job, Models; the update download,
// Settings' Updates). When all of it is one place, that place; else that
// agent's Home when every chat listed belongs to one agent; with nothing
// listed but engines ready, the agent's Home when one runs; else null, and
// the app opens as it was. Pure.
internal object ServiceTap {
  fun of(chatAgents: List<String>, places: List<LaunchTarget>, running: List<String>): LaunchTarget? {
    val all = (chatAgents.map { LaunchTarget(HOME, it) } + places).distinct()
    all.singleOrNull()?.let { return it }
    chatAgents.distinct().singleOrNull()?.let { return LaunchTarget(HOME, it) }
    if (all.isEmpty()) running.singleOrNull()?.let { return LaunchTarget(HOME, it) }
    return null
  }

  private const val HOME = "home"
}
