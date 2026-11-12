package com.phonecando.runner.controllock

// How long one phone-control unlock lasts; the user picks it in Settings →
// Phone control. `wire` is the id JS and the saved record use. Pure.
enum class LockMode(val wire: String) {
  /** Unlock once; it stays until the user locks it, across restarts. */
  INSTALL("install"),

  /** Unlock again after PhoneCanDo restarts or the user closes it. */
  LAUNCH("launch"),

  /** Every agent asks for its own unlock, which ends when it is done. */
  ASK("ask"),
  ;

  companion object {
    /** A fresh install's mode. */
    val DEFAULT = INSTALL

    /** What a saved mode that does not check out reads as. */
    val STRICTEST = ASK

    fun fromWire(wire: String?): LockMode? = entries.firstOrNull { it.wire == wire }
  }
}
