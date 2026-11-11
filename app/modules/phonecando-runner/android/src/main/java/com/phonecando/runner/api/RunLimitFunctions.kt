package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.limits.RunLimitStore
import com.phonecando.runner.limits.RunLimits
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The user's caps on what runs at once (Settings) for JS
// (PhoneCanDoRunner.types.ts NativeRunLimits). They are kept natively
// (RunLimitStore), so the supervisor holds to them with no JS around.
internal fun ModuleDefinitionBuilder.runLimitFunctions(context: () -> Context) {
  // {maxAgents, maxModels}: null for no cap (the default), else 1-99.
  Function("runLimits") {
    RunLimitStore.get(context()).read().toMap()
  }

  // Keeps the caps (a number is rounded into 1-99; null or anything else
  // is no cap) and returns them as kept. A cap lowered below what runs now
  // stops nothing: it applies to the next start.
  Function("setRunLimits") { limits: Map<String, Any?> ->
    RunLimitStore.get(context()).write(RunLimits.fromJs(limits)).toMap()
  }
}
