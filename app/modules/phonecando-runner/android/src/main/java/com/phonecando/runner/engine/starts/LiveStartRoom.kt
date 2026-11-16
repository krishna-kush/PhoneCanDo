package com.phonecando.runner.engine.starts

import android.content.Context
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.limits.RunLimitStore
import com.phonecando.runner.memory.SystemMemory

// StartRoom on this phone now: Android's memory reading, the engines
// starting or ready, and your cap on running agents (RunLimitStore). Off
// the main thread: an engine's status waits for its slot's lock.
internal class LiveStartRoom(context: Context) {
  private val app = context.applicationContext ?: context

  /** Why there is no room to start one more agent now; null when there is. */
  fun refusal(): String? {
    val live = Engines.peek()?.statuses()?.count { it.state == EngineState.STARTING || it.state == EngineState.READY } ?: 0
    val look = StartRoom.Look(SystemMemory(app).read(), live, RunLimitStore.get(app).read().maxAgents)
    return StartRoom.refusal(look)
  }
}
