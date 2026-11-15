package com.phonecando.runner.engine.events

// One line of an agent's events file, as the kit scripts write it
// (agents/kit/scripts): `phonecando-event <name> [message]` appends
// `<name>\t<session>\t<message>`, `phonecando-open <url>` appends
// `@open\t<url>`, `phonecando-inbox` appends `@inbox\t<ids>` (the ids of
// the other agents' messages it put in the agent's turn, space-separated)
// and, the first time each hook event calls it in an engine life,
// `@hook\t<Event>` (`@hook\t<Event>\twait` from its waiting form) for the
// capability checks (checks/).
// A TUI engine is one chat, so we read only the name of an event; its
// session and message are for the agent's own logs. An empty name, an `@`
// verb we do not know, an `@open` without a link, an `@inbox` without an
// id or an `@hook` without an event (or with a third field but `wait`)
// reads as nothing. Pure.
internal sealed interface EventLine {
  /** An event by the agent's own name; its kind's hook map says what it means. */
  data class Named(val name: String) : EventLine

  /** A link the agent wants opened on the phone (a sign-in). */
  data class Open(val url: String) : EventLine

  /** Other agents' messages the agent's hook or reader put in its turn (messages/). */
  data class Inbox(val ids: List<Long>) : EventLine

  /** One of its kind's inbox hooks ran, for the first time in this life; [wait]: its waiting form (checks/). */
  data class Hook(val event: String, val wait: Boolean) : EventLine

  companion object {
    /** The scripts cut a line here; the reader drops a longer one whole. */
    const val MAX_BYTES = 4096

    private const val OPEN = "@open"
    private const val INBOX = "@inbox"
    private const val HOOK = "@hook"
    private const val WAIT = "wait"

    /** At most this many ids a receipt (the runner never puts more unread in a set). */
    private const val MAX_IDS = 256

    fun parse(line: String): EventLine? {
      val text = line.removeSuffix("\r")
      val head = text.substringBefore('\t')
      val rest = text.substringAfter('\t', "")
      return when {
        head == OPEN -> rest.takeIf { it.isNotEmpty() }?.let(::Open)
        head == INBOX -> ids(rest).takeIf { it.isNotEmpty() }?.let(::Inbox)
        head == HOOK -> hook(rest)
        head.isEmpty() || head.startsWith("@") -> null
        else -> Named(head)
      }
    }

    private fun hook(rest: String): Hook? {
      val fields = rest.split('\t')
      val event = fields[0].takeIf { it.isNotEmpty() } ?: return null
      return when {
        fields.size == 1 -> Hook(event, wait = false)
        fields.size == 2 && fields[1] == WAIT -> Hook(event, wait = true)
        else -> null
      }
    }

    private fun ids(text: String): List<Long> =
      text.split(' ', '\t').mapNotNull { it.toLongOrNull()?.takeIf { id -> id > 0 } }.distinct().take(MAX_IDS)
  }
}
