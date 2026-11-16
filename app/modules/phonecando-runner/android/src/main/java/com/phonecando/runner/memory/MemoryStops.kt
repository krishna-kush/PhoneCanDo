package com.phonecando.runner.memory

import java.util.concurrent.ConcurrentHashMap

// When the memory guard last stopped each agent (EngineMemoryHost.stop), in
// this process: a message does not start an agent we stopped to free memory
// minutes ago (messages/start/StartRules), as it would only fill the phone
// again.
internal object MemoryStops {
  private val stops = ConcurrentHashMap<String, Long>()

  fun stopped(agentId: String, at: Long = System.currentTimeMillis()) {
    stops[agentId] = at
  }

  /** Epoch ms the guard last stopped [agentId]; null when it has not in this process. */
  fun at(agentId: String): Long? = stops[agentId]
}
