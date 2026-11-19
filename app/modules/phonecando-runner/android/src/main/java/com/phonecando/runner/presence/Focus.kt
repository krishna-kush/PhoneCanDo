package com.phonecando.runner.presence

// Where the user is looking, as phone_focus tells an agent before it
// reaches them: PhoneCanDo in front or not, what it shows (the caller's
// own chat, another agent's, or another page; null when it is behind),
// and whether the phone is unlocked, locked or its screen off. Pure.
object Focus {
  /** What the phone says now: the app on screen, whose chat it shows (Home with no page over it), the screen on, the keyguard up. */
  data class Facts(val appShown: Boolean, val openAgent: String?, val interactive: Boolean, val locked: Boolean)

  data class Seen(val app: String, val onScreen: String?, val phone: String)

  fun of(facts: Facts, agentId: String): Seen = Seen(
    app = if (facts.appShown) "front" else "back",
    onScreen = when {
      !facts.appShown -> null
      facts.openAgent == agentId -> "your_chat"
      facts.openAgent != null -> "other_agent"
      else -> "app"
    },
    phone = when {
      !facts.interactive -> "off"
      facts.locked -> "locked"
      else -> "unlocked"
    },
  )
}
