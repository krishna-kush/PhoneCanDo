package com.phonecando.agents.kit

// How far other agents' messages reach an agent of a kind, best first, as
// the app shows it and agents_list reports it (`wire`):
//   WAKES      pushed into its turns, and a message that asks can start a
//              turn while it is idle (`inbox.wake`)
//   DELIVERED  pushed into its turns (an `inbox` block), never wakes it
//   INBOX      it has the agents_* tools but nothing is pushed: it reads
//              messages only when it calls agents_inbox
//   NONE       no phone tools at all: it can neither read nor send
// Pure.
enum class MessagingLevel(val wire: String) {
  WAKES("wakes"),
  DELIVERED("delivered"),
  INBOX("inbox"),
  NONE("none"),
  ;

  /** It can read messages at all (anything but NONE). */
  val reads: Boolean get() = this != NONE

  companion object {
    /** From what the kind has: phone tools, an `inbox` block, a way to wake it. */
    fun of(phoneTools: Boolean, pushed: Boolean, wakes: Boolean): MessagingLevel = when {
      pushed && wakes -> WAKES
      pushed -> DELIVERED
      phoneTools -> INBOX
      else -> NONE
    }
  }
}
