package com.phonecando.agents.opencode

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.KindHooks

// opencode's one piece of code: its event stream's frames (EventParser).
// Everything else about it (launch, auth, probes, chat titles, the web UI,
// the TUI) is data in ../agent.json.
object OpencodeHooks : KindHooks {
  const val EVENTS = "opencode.events"

  override val id = "opencode"

  override fun sseParser(name: String): ((String) -> EngineEvent?)? = if (name == EVENTS) EventParser::parse else null
}
