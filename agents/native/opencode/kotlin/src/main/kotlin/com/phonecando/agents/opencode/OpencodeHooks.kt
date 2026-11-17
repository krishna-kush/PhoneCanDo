package com.phonecando.agents.opencode

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.KindHooks

// opencode's code: its event stream's frames (EventParser) and a chat's
// last reply (ReplyParser). Everything else about it (launch, auth, probes,
// chat titles, the web UI, the TUI) is data in ../agent.json.
object OpencodeHooks : KindHooks {
  const val EVENTS = "opencode.events"
  const val REPLY = "opencode.reply"

  override val id = "opencode"

  override fun sseParser(name: String): ((String) -> EngineEvent?)? = if (name == EVENTS) EventParser::parse else null

  override fun replyParser(name: String): ((String) -> String?)? = if (name == REPLY) ReplyParser::parse else null
}
