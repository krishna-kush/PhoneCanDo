package com.phonecando.runner.presence

// What the agent hears about a hand-over: the notes that send it on after
// one, and the bridge's answers while you have the controls. Pure.
object HandsText {
  const val AFTER_WATCH = "The user is done and handed the phone back to you. Observe the screen first; it may have " +
    "changed. Then go on with your task."

  const val AFTER_PAUSED = "The user paused your use of the phone and now hands it back to you. Observe the screen " +
    "first; it may have changed a lot. Then go on with your task."

  /** 409 paused_by_user's message, and a wait that a Stop ended: the agent really stops. */
  const val PAUSED = "the user stopped you and has the phone; you can't see or touch the screen. End your turn now; " +
    "don't wait or call the screen again. We'll message you to go on when they tap Start me again."

  /** A wait that ran out while you still have the phone: it waits again. */
  const val STILL_YOURS = "the user still has the phone. Call phone_wait_for_user again to keep waiting; don't " +
    "end your turn."

  /** 409 user_has_controls's message. */
  const val USER_HAS_CONTROLS = "the user has the controls; call phone_wait_for_user to wait for them, or " +
    "phone_observe to follow along."

  /** 409 user_has_controls for an agent the hand-over is not for: there is nothing of its own to follow. */
  const val SOMEONE_ELSE = "the user has the controls of the phone now; do other work, or end your turn and ask " +
    "them in your chat."

  /** A private hand-over's reply: the agent gave you the phone and can't see it now. */
  const val HANDED_PRIVATE = "the user has the phone now and you can't see it. End your turn now; we'll message " +
    "you to go on when they hand it back."

  /** The resume note after a hand-over in [mode]. */
  fun resume(mode: HandMode): String = if (mode == HandMode.WATCH) AFTER_WATCH else AFTER_PAUSED
}
