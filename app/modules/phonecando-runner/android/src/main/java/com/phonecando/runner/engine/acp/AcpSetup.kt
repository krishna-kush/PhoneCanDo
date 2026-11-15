package com.phonecando.runner.engine.acp

/**
 * What an ACP engine's driver opens chats with, fixed at its launch
 * (EngineLauncher): the chat's folder as the agent sees it (a guest path
 * for an image kind), the kind's `_meta` rendered as JSON, its config
 * options (engine.acp.options), the bridge it gets in its chats (tools
 * "session"; null: none, or its own config names the bridge) and our
 * version for initialize.
 */
internal class AcpSetup(
  val cwd: String,
  val meta: String?,
  val options: Map<String, String>,
  val bridge: AcpBridge?,
  val clientVersion: String,
)
