package com.phonecando.runner.messages

import com.phonecando.runner.bridge.ScreenNotices
import java.util.concurrent.Executor

// The screen line's notices (ScreenLease) as runner notices in the agents'
// inboxes: the holder hears once per waiter that someone waits, and the
// next in line that the screen is reserved for it, which may wake it
// (as a direct message that asks to: its switch, its kind, its engine
// idle and running, its wake budget). Sent on [worker], never on the
// lease's caller's thread.
class ScreenMessages(
  private val mailbox: Mailbox,
  private val worker: Executor,
  private val reservedSec: Long,
) : ScreenNotices {
  override fun waiting(holderId: String, waiterName: String) {
    val text = "$waiterName is waiting for the screen. When you are done with the phone, call mobile_return " +
      "so they get it sooner."
    worker.execute { mailbox.notice(holderId, text) }
  }

  override fun yours(agentId: String) {
    val text = "The screen is yours now. It is kept for you for $reservedSec seconds: call the phone tool you were " +
      "waiting to use. If you no longer need it, call mobile_return so the next agent gets it."
    worker.execute { mailbox.notice(agentId, text, wake = true) }
  }
}
