package com.phonecando.runner.schedule.reply

import com.phonecando.runner.schedule.ScheduleRules

// The server-kind runs whose reply RunReplies waits for: per agent, the run
// whose task is on its way into a chat (set when it fired; a later firing
// of the agent's takes its place), then the chat it went into, watched
// until a run there ends. Each waits at most REPLY_WAIT_MS. A task on its
// way stays through an engine stop (it waits in the mailbox for the next
// start); a watched chat goes with its engine. Thread-safe; pure: the clock
// is injected.
internal class ReplyWatch(private val clock: () -> Long) {
  /** A logged run: its schedule and seq. */
  data class Run(val scheduleId: String, val seq: Long)

  private class Since(val run: Run, val at: Long)

  // Per agent: the run whose task has not gone into a chat yet.
  private val coming = HashMap<String, Since>()

  // Per agent and chat: the run going there.
  private val chats = HashMap<Pair<String, String>, Since>()

  /** [run]'s task is on its way to [agentId]. */
  @Synchronized
  fun coming(agentId: String, run: Run) {
    prune()
    coming[agentId] = Since(run, clock())
  }

  /** The task of [scheduleId] went into [agentId]'s chat [sessionId]: its run, watched there from now; null when none waits for it. */
  @Synchronized
  fun delivered(agentId: String, scheduleId: String, sessionId: String): Run? {
    prune()
    val run = coming[agentId]?.run?.takeIf { it.scheduleId == scheduleId } ?: return null
    coming.remove(agentId)
    chats[agentId to sessionId] = Since(run, clock())
    return run
  }

  /** A run in [agentId]'s chat [sessionId] ended: the run watched there, no longer watched; null when none was. */
  @Synchronized
  fun ended(agentId: String, sessionId: String): Run? {
    val since = chats.remove(agentId to sessionId) ?: return null
    return since.run.takeIf { fresh(since) }
  }

  /** [agentId]'s engine stopped: its chats are no longer watched. */
  @Synchronized
  fun engineGone(agentId: String) {
    chats.keys.removeAll { it.first == agentId }
  }

  @Synchronized
  fun forget(agentId: String) {
    coming.remove(agentId)
    engineGone(agentId)
  }

  private fun fresh(since: Since) = clock() - since.at < ScheduleRules.REPLY_WAIT_MS

  private fun prune() {
    coming.values.removeAll { !fresh(it) }
    chats.values.removeAll { !fresh(it) }
  }
}
