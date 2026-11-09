package com.phonecando.runner.engine

/** An engine's events while it is ready: a server's SSE stream (SseClient), or a TUI's output signals (EngineStreams.openTui). */
internal fun interface EventSource {
  fun stop()
}
