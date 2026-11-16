package com.phonecando.runner.messages.start

import com.phonecando.runner.messages.MessageRules

// The starts messages asked for, per agent, from the ask until its set went
// in or its engine was gone:
// - asked: a set that may wake the stopped agent asked for its start
//   (Handover.STARTING). While pending, the agent counts as starting, so
//   a burst of messages asks once and goes in as one set.
// - began: the engine service took its start (it may wait its turn behind
//   other starts and a model's load), or its engine's start began.
// - ready: its engine is ready: the start came, whatever the set does next.
// - woke: a set went into its run; true when the start was asked under
//   MessageRules.WAKE_TTL_MS ago, so its delivery reads started.
// - gone: its engine stopped, failed or died; true when it was a start of
//   ours that was not ready yet (a failed one, when it failed or died).
// - stale: true once when the start was asked over START_GIVE_UP_MS ago and
//   the service never took it (the request never came to a start).
// Pure: the clock is injected.
class MessageStarts(private val clock: () -> Long) {
  private class Ask(val at: Long, var began: Boolean = false, var ready: Boolean = false)

  private val asks = HashMap<String, Ask>()

  @Synchronized
  fun asked(agentId: String) {
    asks.getOrPut(agentId) { Ask(clock()) }
  }

  @Synchronized
  fun pending(agentId: String): Boolean = agentId in asks

  @Synchronized
  fun began(agentId: String) {
    asks[agentId]?.began = true
  }

  @Synchronized
  fun ready(agentId: String) {
    asks[agentId]?.ready = true
  }

  @Synchronized
  fun woke(agentId: String): Boolean {
    val ask = asks.remove(agentId) ?: return false
    return clock() - ask.at < MessageRules.WAKE_TTL_MS
  }

  @Synchronized
  fun gone(agentId: String): Boolean = asks.remove(agentId)?.ready == false

  @Synchronized
  fun stale(agentId: String): Boolean {
    val ask = asks[agentId] ?: return false
    if (ask.began || clock() - ask.at < MessageRules.START_GIVE_UP_MS) return false
    asks.remove(agentId)
    return true
  }
}
