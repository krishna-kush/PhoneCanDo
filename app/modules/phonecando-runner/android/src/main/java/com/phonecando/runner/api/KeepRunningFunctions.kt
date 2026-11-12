package com.phonecando.runner.api

import android.content.Context
import android.text.format.DateFormat
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.work.KeepAsks
import com.phonecando.runner.engine.work.KeepRunning
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import java.util.Date

// The agent page's "Keep running" switch for JS: an agent kept running is
// never stopped for being idle in the background (engine/work/), only to
// free memory, after the agents with nothing to do. Kept natively
// (KeepRunning), so the runner holds to it with no JS around. Also the
// agent's own ask to stay up (agents_keep_running, KeepAsks), shown under
// the switch.
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

  // The agent's live ask: {reason, until (epoch ms), untilText (as the
  // phone shows a time)}, or null.
  Function("keepRunningAsk") { agentId: String ->
    KeepAsks.shared.get(agentId)?.let { ask ->
      mapOf(
        "reason" to ask.reason,
        "until" to ask.until.toDouble(),
        "untilText" to DateFormat.getTimeFormat(context()).format(Date(ask.until)),
      )
    }
  }
}
