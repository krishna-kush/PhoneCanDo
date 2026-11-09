package com.phonecando.agents.kit.render

// Where a kind lands in the APK's assets (the runner's agents.gradle packages
// it so): assets/agents/<id>/agent.json and its config folder beside it.
object KindAssets {
  const val ROOT = "agents"

  fun manifest(id: String) = "$ROOT/$id/agent.json"

  fun config(id: String) = "$ROOT/$id/config"
}
