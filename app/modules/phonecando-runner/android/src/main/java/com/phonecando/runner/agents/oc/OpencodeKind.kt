package com.phonecando.runner.agents.oc

import com.phonecando.runner.agents.AgentConfig
import com.phonecando.runner.agents.AgentKind
import com.phonecando.runner.agents.EngineEvent
import com.phonecando.runner.agents.HttpProbe
import com.phonecando.runner.agents.LaunchContext
import com.phonecando.runner.agents.LaunchSpec

// opencode as an agent kind. Health is an authenticated GET /api/session;
// events stream from /api/event. The config folder `oc-config` (assets) is
// seeded into ~/.config/opencode, the global config dir upstream reads;
// opencode.json is seeded once so user edits and BYOK keys survive.
object OpencodeKind : AgentKind {
  override val id = "opencode"
  override val displayName = "opencode"
  override val config = AgentConfig(
    assetDir = "oc-config",
    homeDir = ".config/opencode",
    keepIfPresent = setOf("opencode.json"),
  )

  override fun launch(ctx: LaunchContext): LaunchSpec = Launch.spec(ctx)

  override fun healthProbe(port: String, password: String) =
    HttpProbe("http://127.0.0.1:$port/api/session", Auth.headers(password))

  override fun eventStream(port: String, password: String) = HttpProbe(
    "http://127.0.0.1:$port/api/event",
    Auth.headers(password) + ("Accept" to "text/event-stream"),
  )

  override fun parseEvent(frame: String): EngineEvent? = EventParser.parse(frame)

  override fun passwordForms(password: String) = listOf(password, Auth.credential(password))
}
