package com.phonecando.runner.engine.events

import com.phonecando.agents.kit.EngineEvent

// What an agent's events file means, line by line: a named event that its
// kind's hook map (`events[].hook.map`, name to working, waiting, finished
// or failed) lists raises that engine event; `@open` hands its link on to
// the open_url prompt, which checks it (prompts/OpenUrl). Anything else is
// dropped. Pure.
internal class EventSink(
  private val map: Map<String, EngineEvent.Kind>,
  private val onEvent: (EngineEvent.Kind) -> Unit,
  private val onOpen: (url: String) -> Unit,
) {
  fun accept(line: String) {
    when (val parsed = EventLine.parse(line)) {
      is EventLine.Named -> map[parsed.name]?.let(onEvent)
      is EventLine.Open -> onOpen(parsed.url)
      null -> {}
    }
  }
}
