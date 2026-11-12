package com.phonecando.runner.engine.events

// One line of an agent's events file, as the kit scripts write it
// (agents/kit/scripts): `phonecando-event <name> [message]` appends
// `<name>\t<session>\t<message>`, `phonecando-open <url>` appends
// `@open\t<url>`, `phonecando-inbox` appends `@inbox\t<ids>` (the ids of
// the other agents' messages it put in the agent's turn, space-separated).
// A TUI engine is one chat, so we read only the name of an event; its
// session and message are for the agent's own logs. An empty name, an `@`
// verb we do not know, an `@open` without a link or an `@inbox` without an
// id reads as nothing. Pure.
internal sealed interface EventLine {
  /** An event by the agent's own name; its kind's hook map says what it means. */
  data class Named(val name: String) : EventLine

  /** A link the agent wants opened on the phone (a sign-in). */
  data class Open(val url: String) : EventLine

  /** Other agents' messages the agent's hook or reader put in its turn (messages/). */
  data class Inbox(val ids: List<Long>) : EventLine

  companion object {
    /** The scripts cut a line here; the reader drops a longer one whole. */
    const val MAX_BYTES = 4096

    private const val OPEN = "@open"
    private const val INBOX = "@inbox"

    /** At most this many ids a receipt (the runner never puts more unread in a set). */
    private const val MAX_IDS = 256

    fun parse(line: String): EventLine? {
      val text = line.removeSuffix("\r")
      val head = text.substringBefore('\t')
      val rest = text.substringAfter('\t', "")
      return when {
        head == OPEN -> rest.takeIf { it.isNotEmpty() }?.let(::Open)
        head == INBOX -> ids(rest).takeIf { it.isNotEmpty() }?.let(::Inbox)
        head.isEmpty() || head.startsWith("@") -> null
        else -> Named(head)
      }
    }

    private fun ids(text: String): List<Long> =
      text.split(' ', '\t').mapNotNull { it.toLongOrNull()?.takeIf { id -> id > 0 } }.distinct().take(MAX_IDS)
  }
}
