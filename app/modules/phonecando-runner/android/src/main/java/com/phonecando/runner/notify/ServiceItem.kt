package com.phonecando.runner.notify

import com.phonecando.runner.engine.work.WorkWatch

// One thing the service's notification bundles as a notification of its
// own (ServicePlan), with its own tap: an agent (its chats, the jobs it
// left running, starting or stopping; AgentItems) or a job (a download, a
// machine's setup, an install, a model server reading a prompt, our
// update; JobLines). [key] is the same across renders (its tag); [lines]:
// the first is its text, all of them when it has more; [publicText]: what
// the lock screen shows instead, no names; [target]: where a tap lands
// (null: the app as it was); [bar]: its progress bar, if any; [stops]: its
// Stop buttons. Pure.
internal data class ServiceItem(
  val key: String,
  val title: String,
  val lines: List<String>,
  val publicText: String,
  val target: LaunchTarget?,
  val bar: Bar? = null,
  val stops: List<Stop> = emptyList(),
) {
  /** A bar at [percent], or one that only runs (null). */
  data class Bar(val percent: Int?)

  /** A Stop button: the agent and all its jobs, or [job] alone. */
  data class Stop(val label: String, val agentId: String, val job: WorkWatch.Job? = null)
}
