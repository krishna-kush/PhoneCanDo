package com.phonecando.runner.presence

/**
 * Shows the presence over the phone (the full build's mascot on the
 * glass). Called off the main thread, once per change of the frame.
 */
interface PresenceView {
  fun show(frame: PresenceFrame)
}
