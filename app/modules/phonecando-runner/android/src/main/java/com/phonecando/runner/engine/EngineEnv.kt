package com.phonecando.runner.engine

// One engine's environment, in layers: our own process env, then the
// image's engine.env (for a TUI engine also TERMINAL: what our xterm
// renders and UTF-8), then the kind's launch env, then ours on top: the
// bridge URL and this agent's token, a TUI engine's events file (where the
// kit scripts write), the build channel, and the agent tag.
// The tag (PHONECANDO_AGENT=<agentId>) is inherited by everything the engine
// starts, which is how a stop finds every process of an agent (proc/). It
// is set last, so no image or kind can change it. Pure.
object EngineEnv {
  const val AGENT = "PHONECANDO_AGENT"
  const val BRIDGE_URL = "PHONECANDO_BRIDGE_URL"
  const val BRIDGE_TOKEN = "PHONECANDO_BRIDGE_TOKEN"
  const val CHANNEL = "PHONECANDO_CHANNEL"
  const val EVENTS = "PHONECANDO_EVENTS"

  /** What a program on our PTY needs to know about it (as the terminal tab's recipes set). */
  val TERMINAL = mapOf("TERM" to "xterm-256color", "COLORTERM" to "truecolor", "LANG" to "C.UTF-8")

  /** [bridgeUrl] null: the bridge is down and the engine gets neither bridge value; [eventsFile] null: a server engine, none. */
  fun build(
    base: Map<String, String>,
    image: Map<String, String>,
    kind: Map<String, String>,
    bridgeUrl: String?,
    bridgeToken: String,
    channel: String,
    agentId: String,
    eventsFile: String? = null,
  ): Map<String, String> {
    val env = LinkedHashMap<String, String>(base)
    env.putAll(image)
    env.putAll(kind)
    // Never inherited or taken from a file: only this launch decides them.
    env.remove(BRIDGE_URL)
    env.remove(BRIDGE_TOKEN)
    env.remove(EVENTS)
    if (bridgeUrl != null) {
      env[BRIDGE_URL] = bridgeUrl
      env[BRIDGE_TOKEN] = bridgeToken
    }
    if (eventsFile != null) env[EVENTS] = eventsFile
    env[CHANNEL] = channel
    env[AGENT] = agentId
    return env
  }
}
