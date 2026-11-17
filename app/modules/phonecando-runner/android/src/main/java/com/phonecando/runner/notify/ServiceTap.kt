package com.phonecando.runner.notify

// Where a tap on the service's own notification lands (the bundle's head,
// or the ready line; each item has its own tap): on what it is about. A
// chat lands on its agent's Home; [places] are the items' (an agent at
// work, its Home; an agent's install or its machine's setup, the agent's
// page with its bar; a system's download, Systems; a model job, Models;
// the update download, Settings' Updates). When all of it is one place,
// that place; else that agent's Home when every chat listed belongs to one
// agent; with nothing listed but engines ready, the agent's Home when one
// runs; else null, and the app opens as it was. Pure.
internal object ServiceTap {
  fun of(chatAgents: List<String>, places: List<LaunchTarget>, running: List<String>): LaunchTarget? {
    val all = (chatAgents.map { LaunchTarget(LaunchTarget.HOME, it) } + places).distinct()
    all.singleOrNull()?.let { return it }
    chatAgents.distinct().singleOrNull()?.let { return LaunchTarget(LaunchTarget.HOME, it) }
    if (all.isEmpty()) running.singleOrNull()?.let { return LaunchTarget(LaunchTarget.HOME, it) }
    return null
  }
}
