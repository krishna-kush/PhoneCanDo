package com.phonecando.runner.presence.glass.scene

import com.phonecando.runner.presence.UserAct

/** What a button does that is the glass's own, not a step of the hands: you are done in a pause, or open the agent's chat. */
enum class Own { REST, OPEN_APP }

/** A card's button: what it says and what it does, a step of the hands ([act]) or the glass's own ([own]). */
data class Button(
  val label: String,
  val act: UserAct? = null,
  val own: Own? = null,
  val small: Boolean = false,
  val says: String = label,
)

/** A card's words and buttons, the first button the main one; [kicker] is its small label on top. */
data class CardCopy(val kicker: String, val title: String, val line: String?, val buttons: List<Button>)

// Every word the glass says. Short and friendly, in the mascot's voice
// where it speaks for itself.
object GlassCopy {
  fun card(card: Card, scene: Scene): CardCopy? = when (card) {
    Card.NONE -> null
    Card.CONTROLS -> CardCopy(
      kicker = "At the controls",
      title = "${scene.name} is driving",
      line = "Let me: you drive, it watches. Stop: it stops until you start it again.",
      buttons = listOf(
        Button("Let me", UserAct.LET_ME, says = "Let me drive while ${scene.name} watches"),
        Button("Stop", UserAct.STOP, says = "Stop ${scene.name} and take the phone"),
      ),
    )
    Card.YOUR_TURN -> CardCopy(
      kicker = "You drive, I watch",
      title = scene.why ?: "Your turn",
      line = "${scene.name} is watching",
      buttons = listOf(Button("Done", UserAct.GIVE_BACK, says = "Done, hand the phone back to ${scene.name}")),
    )
    Card.NOT_LOOKING -> CardCopy(
      kicker = "Eyes shut",
      title = "Not looking",
      line = scene.why ?: "${scene.name} can't see your screen.",
      buttons = listOf(Button("I'm done", own = Own.REST, says = "I'm done with the phone")),
    )
    Card.ASLEEP -> CardCopy(
      kicker = "On a break",
      title = "${scene.name} is paused",
      line = "It can't use the phone until you start it again.",
      buttons = listOf(
        Button("Start me again", UserAct.START_AGAIN, says = "Start ${scene.name} again"),
        Button("Go to app", own = Own.OPEN_APP, says = "Open ${scene.name}'s chat in PhoneCanDo"),
        Button("Leave it", UserAct.LEAVE, small = true, says = "Keep ${scene.name} stopped, with no note to go on"),
      ),
    )
  }

  /** Go to app, PhoneCanDo opening on its chat; and when its chat was already on the screen. */
  const val OPENING_CHAT = "Opening my chat"
  const val IN_CHAT = "You're in my chat"

  /** You touched the screen while it drove: it hands you the phone and watches. */
  const val YOU_TOOK_IT = "All yours, I'll watch"

  /** What a screen reader hears for the mascot itself. */
  fun mascot(scene: Scene, show: Show): String = when (scene.act) {
    Act.DRIVING -> listOfNotNull("${scene.name} is driving your phone", show.bubble).joinToString(". ") + ". Tap for controls."
    Act.WATCH -> "${scene.name} is watching. Your turn."
    Act.PAUSED -> if (show.asleep) "${scene.name} is paused." else "${scene.name} is paused and not looking."
  }
}
