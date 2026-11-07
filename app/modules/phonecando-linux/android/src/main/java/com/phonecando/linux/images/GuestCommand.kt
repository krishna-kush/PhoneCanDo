package com.phonecando.linux.images

import com.phonecando.lre.api.ImageLayout
import java.io.File

/**
 * How we run one guest command for the runtime (a reset's package query):
 * the image's shim for argv[0] (a link to our launcher), with the app's
 * environment, then every engine.env line, then PHONECANDO_IMAGE. Never the
 * engine tag PHONECANDO_AGENT: an engine start reaps whatever carries it.
 * Pure.
 */
data class GuestCommand(val argv: List<String>, val env: Map<String, String>) {
  companion object {
    private val NAME = Regex("[A-Za-z_][A-Za-z0-9_]*")
    const val AGENT_TAG = "PHONECANDO_AGENT"

    fun build(layout: ImageLayout, argv: List<String>, engineEnv: String, base: Map<String, String>): GuestCommand {
      val command = argv.firstOrNull() ?: throw IllegalArgumentException("empty argv")
      require(command.isNotEmpty() && '/' !in command && !command.startsWith(".")) { "not a command name: $command" }
      val env = LinkedHashMap(base)
      env.remove(AGENT_TAG)
      env.putAll(parseEnv(engineEnv))
      env["PHONECANDO_IMAGE"] = layout.root.path
      return GuestCommand(listOf(File(layout.shims, command).path) + argv.drop(1), env)
    }

    /** engine.env: `KEY=VALUE` lines, no quotes, no expansion; a later line wins. */
    fun parseEnv(text: String): Map<String, String> {
      val out = LinkedHashMap<String, String>()
      for (raw in text.split('\n')) {
        val line = raw.removeSuffix("\r")
        val eq = line.indexOf('=')
        if (eq <= 0) continue
        val key = line.substring(0, eq)
        if (NAME.matches(key) && key != AGENT_TAG) out[key] = line.substring(eq + 1)
      }
      return out
    }
  }
}
