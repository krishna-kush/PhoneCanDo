package com.phonecando.runner.presence

import java.util.concurrent.ConcurrentHashMap

// Each agent's mascot as ready-made figures for its poses, from the app
// (mascot/ is the one spec: JS lays the figures out and pushes them here
// at start and on every change of look). The overlay draws from them.
// Memory only: a new process gets them again from JS.
object MascotFigures {
  private val byAgent = ConcurrentHashMap<String, String>()

  @Volatile
  var listener: ((agentId: String) -> Unit)? = null

  fun set(agentId: String, json: String) {
    byAgent[agentId] = json
    listener?.let { runCatching { it(agentId) } }
  }

  fun get(agentId: String): String? = byAgent[agentId]
}
