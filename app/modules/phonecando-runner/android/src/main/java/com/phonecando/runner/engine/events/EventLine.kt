package com.phonecando.runner.engine.events

// One line of an agent's events file, as the kit scripts write it
// (agents/kit/scripts): `phonecando-event <name> [message]` appends
// `<name>\t<session>\t<message>`, `phonecando-open <url>` appends
// `@open\t<url>`. A TUI engine is one chat, so we read only the name of an
// event; its session and message are for the agent's own logs. An empty
// name, an `@` verb we do not know or an `@open` without a link reads as
// nothing. Pure.
internal sealed interface EventLine {
  /** An event by the agent's own name; its kind's hook map says what it means. */
  data class Named(val name: String) : EventLine

  /** A link the agent wants opened on the phone (a sign-in). */
  data class Open(val url: String) : EventLine

  companion object {
    /** The scripts cut a line here; the reader drops a longer one whole. */
    const val MAX_BYTES = 4096

    private const val OPEN = "@open"

    fun parse(line: String): EventLine? {
      val text = line.removeSuffix("\r")
      val head = text.substringBefore('\t')
      val rest = text.substringAfter('\t', "")
      return when {
        head == OPEN -> rest.takeIf { it.isNotEmpty() }?.let(::Open)
        head.isEmpty() || head.startsWith("@") -> null
        else -> Named(head)
      }
    }
  }
}
