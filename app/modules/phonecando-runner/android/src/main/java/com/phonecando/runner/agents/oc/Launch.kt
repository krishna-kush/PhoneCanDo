package com.phonecando.runner.agents.oc

import com.phonecando.runner.agents.LaunchContext
import com.phonecando.runner.agents.LaunchSpec

// `opencode serve` on loopback. The engine is a native bionic binary
// executed straight from the native-library dir (its INTERP is the OS
// linker); the renderer lib path and the disabled file watcher are part of
// the payload contract (docs/bootstrap/oc-build.md). No model pin: fresh
// sessions inherit the upstream default.
internal object Launch {
  const val ENGINE_LIB = "liboc-engine.so"
  const val RENDERER_LIB = "liboc-opentui.so"

  fun spec(ctx: LaunchContext): LaunchSpec = LaunchSpec(
    argv = listOf(
      "${ctx.libDir}/$ENGINE_LIB",
      "serve", "--port", ctx.port, "--hostname", "127.0.0.1",
    ),
    env = mapOf(
      "OPENCODE_DISABLE_AUTOUPDATE" to "1",
      "OPENCODE_DISABLE_LSP_DOWNLOAD" to "1",
      "OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER" to "true",
      "OPENCODE_SERVER_PASSWORD" to ctx.password,
      "OPENTUI_LIB_PATH" to "${ctx.libDir}/$RENDERER_LIB",
    ),
  )
}
