package com.phonecando.runner.checks.now

import com.phonecando.runner.engine.EngineMode

/**
 * The parts a Check now runs, in order: each starts the agent's engine in
 * [Part.mode] with [Part.task] as its first prompt (null: none, the part
 * only opens the chat), in a new chat or not ([Part.newChat]); [Part.tests]
 * are the capabilities (wire ids) it waits on a verdict for, [Part.skips]
 * the ones it can't test; [Part.holdsChat]: a later part opens its ACP chat,
 * so it ends only once that chat is open (with nothing left to test, it runs
 * for that alone). Pure.
 */
data class CheckPlan(val parts: List<Part>) {
  data class Part(
    val mode: EngineMode,
    val task: String?,
    val newChat: Boolean,
    val tests: List<String> = emptyList(),
    val skips: List<String> = emptyList(),
    val holdsChat: Boolean = false,
  )

  init {
    require(parts.isNotEmpty()) { "a check has at least one part" }
  }
}
