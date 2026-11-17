package com.phonecando.runner.engine.acp

/**
 * What an ACP engine's driver opens chats with, fixed at its launch
 * (EngineLauncher): the chat's folder as the agent sees it (a guest path
 * for an image kind), the kind's `_meta` rendered as JSON, its config
 * options (engine.acp.options), the bridge it gets in its chats (tools
 * "session"; null: none, or its own config names the bridge), our
 * version for initialize, and the options its hook reads from the
 * agent's HOME, asked at each chat open (engine.acp.optionsHook), so a
 * choice made in its own UI since the launch counts.
 */
internal class AcpSetup(
  val cwd: String,
  val meta: String?,
  val options: Map<String, String>,
  val bridge: AcpBridge?,
  val clientVersion: String,
  val homeOptions: () -> Map<String, String> = { emptyMap() },
)
