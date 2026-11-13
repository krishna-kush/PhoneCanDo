package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.agents.kit.manifest.InboxEndpoint
import com.phonecando.agents.kit.manifest.InboxFormat
import com.phonecando.agents.kit.manifest.InboxHook
import com.phonecando.agents.kit.manifest.InboxWake
import com.phonecando.agents.kit.manifest.Manifest
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive

// What ManifestKind.of() refuses in an `inbox` block (KindChecks' part for
// it): a block with no way in; a hook event whose name is no plain file name
// (the runner writes `<Event>.out` for it), whose template lacks
// {{messages}} or names anything else, or whose json string template is no
// JSON once filled or puts the messages outside a JSON string; a server
// block on an engine with no port, or a call whose body lacks {{messages}}
// or that names what it cannot have (the create call: {{title}} only); a
// wake mode the block does not support.
internal object InboxChecks {
  // As phonecando-event's names (the TS validator's PATTERNS.eventName).
  private val EVENT_NAME = Regex("[A-Za-z0-9][A-Za-z0-9._:-]{0,63}")
  private const val MESSAGES = "{{${InboxSeam.MESSAGES}}}"

  // Messages no text has, to find where a json template puts them.
  private const val PROBE = "\u0000inbox\u0000"

  fun check(manifest: Manifest) {
    val id = manifest.id
    val inbox = manifest.inbox ?: return
    if (inbox.hooks.isEmpty() && inbox.server == null && !inbox.reader) {
      throw KindException("$id: inbox names no way in (hooks, server or reader: true)")
    }
    for ((event, hook) in inbox.hooks) {
      val at = "inbox.hooks.$event"
      if (!EVENT_NAME.matches(event)) throw KindException("$id: $event is no hook event name (1 to 64 of A-Z a-z 0-9 . _ : -)")
      val strings = InboxSeam.strings(hook.template)
      strings.forEach { only(id, at, it, InboxSeam.HOOK_PLACEHOLDERS) }
      if (strings.none { MESSAGES in it }) throw KindException("$id: $at's template has no $MESSAGES")
      if (hook.format == InboxFormat.JSON && hook.template is JsonPrimitive) json(id, at, hook)
    }
    inbox.server?.let { server ->
      if (manifest.engine?.style != EngineStyle.SERVER) throw KindException("$id: inbox.server needs a server engine")
      endpoint(id, "inbox.server.deliver", server.deliver)
      server.wake?.let { endpoint(id, "inbox.server.wake", it) }
      server.latest?.let { lookup ->
        if (!lookup.path.startsWith('/') || lookup.path.any(Char::isWhitespace) || Templates.names(lookup.path).isNotEmpty()) {
          throw KindException("$id: inbox.server.latest.path must be a path on the engine (/…, no spaces, no placeholders)")
        }
        if (!lookup.id.startsWith('/')) throw KindException("$id: inbox.server.latest.id must be a JSON pointer (/…)")
      }
      server.create?.let { create ->
        if (!create.path.startsWith('/') || create.path.any(Char::isWhitespace) || Templates.names(create.path).isNotEmpty()) {
          throw KindException("$id: inbox.server.create.path must be a path on the engine (/…, no spaces, no placeholders)")
        }
        InboxSeam.strings(create.body).forEach { only(id, "inbox.server.create.body", it, InboxSeam.CREATE_PLACEHOLDERS) }
        if (!create.id.startsWith('/')) throw KindException("$id: inbox.server.create.id must be a JSON pointer (/…)")
      }
    }
    val supported = when (inbox.wake) {
      null -> true
      InboxWake.HOOK -> inbox.hooks.isNotEmpty()
      InboxWake.SERVER -> inbox.server?.wake != null
      InboxWake.READER -> inbox.reader
    }
    if (!supported) {
      val needs = mapOf(InboxWake.HOOK to "inbox.hooks", InboxWake.SERVER to "inbox.server.wake", InboxWake.READER to "inbox.reader: true")
      throw KindException("$id: inbox.wake ${inbox.wake!!.wire} needs ${needs.getValue(inbox.wake!!)}")
    }
  }

  private fun endpoint(id: String, at: String, endpoint: InboxEndpoint) {
    if (!endpoint.path.startsWith('/') || endpoint.path.any(Char::isWhitespace)) {
      throw KindException("$id: $at.path must be a path on the engine (/…, no spaces)")
    }
    only(id, "$at.path", endpoint.path, InboxSeam.PATH_PLACEHOLDERS)
    val strings = InboxSeam.strings(endpoint.body)
    strings.forEach { only(id, "$at.body", it, InboxSeam.BODY_PLACEHOLDERS) }
    if (strings.none { MESSAGES in it }) throw KindException("$id: $at.body has no $MESSAGES")
  }

  private fun only(id: String, at: String, text: String, allowed: Set<String>) {
    val other = Templates.names(text).firstOrNull { it !in allowed } ?: return
    throw KindException("$id: $at may name ${allowed.joinToString { "{{$it}}" }}, not {{$other}}")
  }

  // A json string template is JSON once {{messages}} is filled, with the
  // messages inside a JSON string.
  private fun json(id: String, at: String, hook: InboxHook) {
    val tree = try {
      Json.parseToJsonElement(InboxSeam.hook(hook, PROBE))
    } catch (e: SerializationException) {
      throw KindException("$id: $at's template is no JSON (${e.message?.lineSequence()?.firstOrNull()})")
    }
    if (InboxSeam.strings(tree).none { PROBE in it }) throw KindException("$id: $at's template puts $MESSAGES outside a JSON string")
  }
}
