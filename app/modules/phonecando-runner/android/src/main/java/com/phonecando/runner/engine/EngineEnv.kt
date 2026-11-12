package com.phonecando.runner.engine

import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.term.TermTheme

// One engine's environment, in layers: our own process env, then the
// image's engine.env (for a TUI engine also terminal(): what our xterm
// renders, UTF-8 and the theme), then the kind's launch env, then ours on top: the
// bridge URL and this agent's token (only for a kind with phone tools,
// BridgeAccess; else neither), a TUI engine's events file (where the
// kit scripts write), the agent's inbox folder for a kind with an `inbox`
// block (other agents' messages, messages/), the build channel, and the
// agent tag.
// The tag (PHONECANDO_AGENT=<agentId>) is inherited by everything the engine
// starts, which is how a stop finds every process of an agent (proc/). It
// is set last, so no image or kind can change it. A local model server
// carries AGENT=model-server and MODEL=<model id> (models/ModelServer).
// An image kind's engine is a guest of its machine, whose launch.conf
// unsets what any agent's kind there keeps from guests (kit GuestEnvPolicy:
// the machine's union); carry() renames the ones it still needs
// (GuestEnvPolicy.carry) past the launcher (kit ImageLaunch.CARRY_PREFIX +
// name), and its launch script puts them back. Pure.
object EngineEnv {
  const val AGENT = "PHONECANDO_AGENT"

  /** A model server's model id, beside AGENT=model-server: how the memory guard tells servers apart. */
  const val MODEL = "PHONECANDO_MODEL"
  const val BRIDGE_URL = "PHONECANDO_BRIDGE_URL"
  const val BRIDGE_TOKEN = "PHONECANDO_BRIDGE_TOKEN"
  const val CHANNEL = "PHONECANDO_CHANNEL"
  const val EVENTS = "PHONECANDO_EVENTS"
  const val INBOX = "PHONECANDO_INBOX"

  /** What a program on our PTY needs to know about it (as the terminal tab's recipes set). */
  val TERMINAL = mapOf("TERM" to "xterm-256color", "COLORTERM" to "truecolor", "LANG" to "C.UTF-8")

  const val COLORFGBG = "COLORFGBG"

  /**
   * [TERMINAL], and whether the terminal is dark or light as COLORFGBG
   * when the app has told us its [theme] (TerminalThemes); the program
   * keeps that value until it restarts.
   */
  fun terminal(theme: TermTheme?): Map<String, String> =
    if (theme == null) TERMINAL else TERMINAL + (COLORFGBG to theme.colorFgBg)

  /**
   * [bridgeUrl] null: the bridge is down and the engine gets neither bridge
   * value; [eventsFile] null: a server engine, none; [inboxDir] null: a
   * kind without an inbox block, none.
   */
  fun build(
    base: Map<String, String>,
    image: Map<String, String>,
    kind: Map<String, String>,
    bridgeUrl: String?,
    bridgeToken: String,
    channel: String,
    agentId: String,
    eventsFile: String? = null,
    inboxDir: String? = null,
  ): Map<String, String> {
    val env = LinkedHashMap<String, String>(base)
    env.putAll(image)
    env.putAll(kind)
    // Never inherited or taken from a file: only this launch decides them.
    env.remove(BRIDGE_URL)
    env.remove(BRIDGE_TOKEN)
    env.remove(EVENTS)
    env.remove(INBOX)
    if (bridgeUrl != null) {
      env[BRIDGE_URL] = bridgeUrl
      env[BRIDGE_TOKEN] = bridgeToken
    }
    if (eventsFile != null) env[EVENTS] = eventsFile
    if (inboxDir != null) env[INBOX] = inboxDir
    env[CHANNEL] = channel
    env[AGENT] = agentId
    return env
  }

  /**
   * [env] with each of [names] renamed to its carry name (kit
   * ImageLaunch.carried). Carry names are never inherited or taken from a
   * file: only this launch sets them.
   */
  fun carry(env: Map<String, String>, names: Set<String>): Map<String, String> =
    ImageLaunch.carried(env.filterKeys { !it.startsWith(ImageLaunch.CARRY_PREFIX) }, names)
}
