package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.engine.Engines
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The memory guard's reading for JS (PhoneCanDoRunner.types.ts
// NativeMemoryStatus); changes come as the phonecandoMemory event.
internal fun ModuleDefinitionBuilder.memoryFunctions(context: () -> Context) {
  // The reading now, with what each running agent and model server takes
  // (reads our processes in /proc: a few ms). Synchronous.
  Function("memoryStatus") {
    Engines.memory(context()).status().toMap()
  }
}
