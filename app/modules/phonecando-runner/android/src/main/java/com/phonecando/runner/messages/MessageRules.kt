package com.phonecando.runner.messages

// Every number agent messaging holds to, in one place (MessagePolicyTest
// pins them). Pure.
object MessageRules {
  /** A message's text, after sanitising (MessageText). */
  const val MAX_CHARS = 4000

  /** The log keeps the newest this many messages... */
  const val LOG_MAX = 500

  /** ...none older than this. */
  const val LOG_MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

  /** Unread messages one agent may have; past it the oldest are dropped, with a notice. */
  const val UNREAD_MAX = 50

  const val MINUTE_MS = 60_000L
  const val HOUR_MS = 60 * MINUTE_MS

  /** Direct messages from one agent to another. */
  const val DIRECT_PER_MINUTE = 5
  const val DIRECT_PER_HOUR = 30

  /** Broadcasts from one agent (to its machine or the phone). */
  const val BROADCAST_PER_MINUTE = 2
  const val BROADCAST_PER_HOUR = 10

  /** The same text from the same sender to the same target within this is dropped. */
  const val DUPLICATE_MS = MINUTE_MS

  /** Times one agent may be woken by messages in an hour. */
  const val WAKES_PER_HOUR = 6

  /** A message with this hop or more never wakes anyone. */
  const val NO_WAKE_HOP = 2

  /** A wake asked for longer ago than this no longer wakes (the recipient sees it at its next turn). */
  const val WAKE_TTL_MS = 10 * MINUTE_MS

  /** A woken agent that shows no run within this was not woken after all. */
  const val WAKE_START_MS = MINUTE_MS

  /** agents_wait blocks at most this long. */
  const val WAIT_MAX_SEC = 30

  /** agents_inbox returns this many by default, and at most [INBOX_MAX]. */
  const val INBOX_DEFAULT = 20
  const val INBOX_MAX = 50

  /** messageLog returns at most this many. */
  const val LOG_PAGE_MAX = LOG_MAX
}
