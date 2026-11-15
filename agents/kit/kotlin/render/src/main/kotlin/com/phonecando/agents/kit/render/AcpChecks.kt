package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.AcpSpec
import com.phonecando.agents.kit.manifest.ArgvItem
import com.phonecando.agents.kit.manifest.ChatArgs
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.manifest.Manifest
import kotlinx.serialization.json.JsonObject

// What ManifestKind.of() refuses in an `engine.acp` block (KindChecks' part
// for it): an ACP mode on an engine that is no TUI; an argv with no program
// first; a template that names what a launch has no value for ({{prompt}},
// {{chatId}}, a model's or the state folder's), or {{password}} anywhere but
// an env value or the meta; more session options than AcpSpec.MAX_OPTIONS,
// or an id or a value of no or too many characters; a meta larger than
// AcpSpec.MAX_META_BYTES; chat args that do not hold {{chatId}} as one
// whole arg, once, or that go in out of range or before a shell script's $0.
internal object AcpChecks {
  // What a launch's env values may name (the TS validator's PLACEHOLDERS).
  private val VALUES = setOf("libDir", "home", "tmp", "port", "serverUrl", "bridgeUrl", "password", "projectDir", "sessionId", "code")

  // What an arg may name: never the password, which would show in a process list.
  private val ARGS = VALUES - "password"

  fun check(manifest: Manifest) {
    val engine = manifest.engine ?: return
    val acp = engine.acp ?: return
    val id = manifest.id
    if (engine.style != EngineStyle.TUI) throw KindException("$id: an ACP mode needs a tui engine")
    if (acp.argv.firstOrNull() !is ArgvItem.Text) throw KindException("$id: engine.acp.argv starts with its program")
    for (item in acp.argv) {
      when (item) {
        is ArgvItem.Text -> only(id, "engine.acp.argv", item.template, ARGS)
        is ArgvItem.When -> {
          if (item.placeholder !in VALUES) throw KindException("$id: engine.acp.argv's when names no launch placeholder ({{${item.placeholder}}})")
          item.args.forEach { only(id, "engine.acp.argv", it, ARGS) }
        }
      }
    }
    acp.env.values.forEach { only(id, "engine.acp.env", it, VALUES) }
    options(id, acp.options)
    acp.meta?.let { meta(id, it) }
    acp.chat?.let { chat(id, it, engine.launch?.argv.orEmpty()) }
  }

  private fun options(id: String, options: Map<String, String>) {
    if (options.size > AcpSpec.MAX_OPTIONS) throw KindException("$id: engine.acp.options sets at most ${AcpSpec.MAX_OPTIONS}")
    val lengths = 1..AcpSpec.MAX_OPTION_LENGTH
    for ((key, value) in options) {
      if (key.length !in lengths || value.length !in lengths) {
        throw KindException("$id: engine.acp.options $key: an id and a value of 1 to ${AcpSpec.MAX_OPTION_LENGTH} characters")
      }
    }
  }

  private fun meta(id: String, meta: JsonObject) {
    if (meta.toString().toByteArray(Charsets.UTF_8).size > AcpSpec.MAX_META_BYTES) {
      throw KindException("$id: engine.acp.meta is at most ${AcpSpec.MAX_META_BYTES / 1024} KiB")
    }
    JsonTemplates.strings(meta).forEach { only(id, "engine.acp.meta", it, VALUES) }
  }

  // The chat id is one argv item: exactly one arg is `{{chatId}}`, whole,
  // and no other names it.
  private fun chat(id: String, chat: ChatArgs, argv: List<ArgvItem>) {
    val whole = "{{${ChatArgs.PLACEHOLDER}}}"
    val naming = chat.args.filter { ChatArgs.PLACEHOLDER in Templates.names(it) }
    if (naming != listOf(whole)) throw KindException("$id: engine.acp.chat.args holds $whole as one whole arg, once")
    chat.args.forEach { only(id, "engine.acp.chat.args", it, ARGS + ChatArgs.PLACEHOLDER) }
    chat.at?.let { KindChecks.insertAt(id, "engine.acp.chat.at", it, argv) }
  }

  private fun only(id: String, at: String, text: String, allowed: Set<String>) {
    val other = Templates.names(text).firstOrNull { it !in allowed } ?: return
    throw KindException("$id: $at cannot name {{$other}}")
  }
}
