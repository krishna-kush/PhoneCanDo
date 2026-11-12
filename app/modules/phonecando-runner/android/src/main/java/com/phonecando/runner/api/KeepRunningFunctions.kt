package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.work.KeepRunning
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The agent page's "Keep running" switch for JS: an agent kept running is
// never stopped for being idle in the background (engine/work/), only to
// free memory, after the agents with nothing to do. Kept natively
// (KeepRunning), so the runner holds to it with no JS around.
internal fun ModuleDefinitionBuilder.keepRunningFunctions(context: () -> Context) {
  Function("keepRunning") { agentId: String ->
    KeepRunning.get(context()).isOn(agentId)
  }

  // Returns the switch as kept. Turned off with the app in the background,
  // the agent stops at the next look once it is idle with no job left.
  Function("setKeepRunning") { agentId: String, on: Boolean ->
    val ctx = context()
    KeepRunning.get(ctx).set(agentId, on)
    Engines.work()?.poke()
    KeepRunning.get(ctx).isOn(agentId)
  }
}
