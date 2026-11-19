package com.phonecando.runner.autooff

// Auto off's one rule (AutoOffWatch asks it each tick). Payment and bank
// apps refuse to open while an accessibility service Google has not
// reviewed is on, ours included, so with Auto off on the service turns
// itself off once PhoneCanDo has been out of sight and no agent has wanted
// the screen for QUIET_MS. Never in WARM_UP_MS after it connects: the user
// who just flipped the switch is still in Android's Settings, and the agent
// that asked for it (mobile_open_accessibility) has not taken the screen
// yet. Pure: times are one monotonic clock's.
object AutoOffRules {
  /** How often the watch looks. */
  const val TICK_MS = 2_000L

  /** Out of sight and unwanted this long, then off: long enough for a quick look at another app. */
  const val QUIET_MS = 10_000L

  /** Just connected: stays on at least this long. */
  const val WARM_UP_MS = 120_000L

  data class Facts(
    /** The user's Auto off switch. */
    val on: Boolean,
    /** PhoneCanDo is on screen. */
    val appInFront: Boolean,
    /** An agent holds, is kept or waits for the screen, or you have the controls it handed over. */
    val screenWanted: Boolean,
    /** When the service connected. */
    val connectedAt: Long,
  )

  /** When the quiet began (null: not quiet now), and whether the service goes off now. */
  data class Step(val quietSince: Long?, val turnOff: Boolean)

  fun step(facts: Facts, quietSince: Long?, now: Long): Step {
    if (!facts.on || facts.appInFront || facts.screenWanted) return Step(null, false)
    val since = quietSince ?: now
    return Step(since, now - since >= QUIET_MS && now - facts.connectedAt >= WARM_UP_MS)
  }
}
