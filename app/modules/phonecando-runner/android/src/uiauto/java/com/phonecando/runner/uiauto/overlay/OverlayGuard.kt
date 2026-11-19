package com.phonecando.runner.uiauto.overlay

import com.phonecando.runner.presence.glass.motion.Pt

// Keeps the overlay out of the driving agent's way (GuardedBackend): what
// it sees and where it touches are the app under it, never our glass.
interface OverlayGuard {
  /** Runs [block] (a screenshot) with the overlay off the screen. */
  suspend fun <T> hidden(block: suspend () -> T): T

  /**
   * Runs [block] (a tap, long press or swipe along [path], screen pixels;
   * empty when the spot is not known) with the overlay letting touches
   * through. [path] comes first so the mascot can look there and move out
   * of the way; letting touches through holds even when it can't.
   */
  suspend fun <T> touchThrough(path: List<Pt>, block: suspend () -> T): T

  companion object {
    /** No overlay: runs every block as it is. */
    val NONE: OverlayGuard = object : OverlayGuard {
      override suspend fun <T> hidden(block: suspend () -> T): T = block()

      override suspend fun <T> touchThrough(path: List<Pt>, block: suspend () -> T): T = block()
    }
  }
}
