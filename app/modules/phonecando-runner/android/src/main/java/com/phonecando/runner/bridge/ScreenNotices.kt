package com.phonecando.runner.bridge

// What the screen line tells agents (ScreenLease): the messages side
// delivers them as runner notices. The lease calls them outside its lock,
// so an implementation may read the line back (ScreenLease.line).
interface ScreenNotices {
  /** [waiterName] joined the line while [holderId] has the screen; once per waiter. */
  fun waiting(holderId: String, waiterName: String)

  /** The screen is reserved for [agentId] now, for the lease's idle time; may wake it. */
  fun yours(agentId: String)

  companion object {
    /** Tells nobody. */
    val NONE: ScreenNotices = object : ScreenNotices {
      override fun waiting(holderId: String, waiterName: String) = Unit

      override fun yours(agentId: String) = Unit
    }
  }
}
