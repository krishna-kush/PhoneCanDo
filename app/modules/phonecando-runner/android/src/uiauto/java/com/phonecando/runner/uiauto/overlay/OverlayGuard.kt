package com.phonecando.runner.uiauto.overlay

// Keeps the overlay out of the driving agent's way (GuardedBackend): what
// it sees and where it touches are the app under it, never our pill.
interface OverlayGuard {
  /** Runs [block] (a screenshot) with the overlay off the screen. */
  suspend fun <T> hidden(block: suspend () -> T): T

  /** Runs [block] (a tap, long press or swipe) with the pill letting touches through. */
  suspend fun <T> touchThrough(block: suspend () -> T): T

  companion object {
    /** No overlay: runs every block as it is. */
    val NONE: OverlayGuard = object : OverlayGuard {
      override suspend fun <T> hidden(block: suspend () -> T): T = block()

      override suspend fun <T> touchThrough(block: suspend () -> T): T = block()
    }
  }
}
