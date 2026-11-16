package com.phonecando.runner.messages.start

import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.starts.StartHolds
import com.phonecando.runner.messages.MessageRules

// Whether a message that may wake a stopped agent starts it, and in which
// mode (MessagePolicy has checked the rest first: a direct message that
// asked, "Other agents can wake it" on, the hop, its age and the hourly
// budget):
//   kind with an ACP mode               ACP, with no screen: the set goes in
//                                       as its first prompt once it is ready
//   kind that wakes through its server  as usual: the server's wake call
//                                       takes the set once it is ready
//   any other kind                      never: its messages wait for its next run
// Not now, with why, while a check found that waking it does not work (its
// level now is below wakes), a Linux job runs on its machine (Update agent
// or a setup replacing its files), Check now has it (between its parts a
// start could take the check's first prompt), the app is opening it, its
// last start failed or an ACP turn of it went silent (StartHolds)
// under StartHolds.HOLD_MS ago, the memory guard stopped it under
// MEMORY_STOP_HOLD_MS ago, or the phone has no room (StartRoom: memory,
// your cap on running agents). A stop you made is no reason: the switch
// says the user lets other agents wake it. Pure.
object StartRules {
  /** A stopped agent as a start for a message sees it. */
  data class Look(
    /** Its kind has an ACP mode (`engine.acp`). */
    val speaksAcp: Boolean,
    /** Its kind wakes through its own server (`inbox.wake` server). */
    val wakesByServer: Boolean,
    /** Its kind's messaging level now is wakes (Checks.levelNow). */
    val levelWakes: Boolean,
    /** A Linux job runs on its machine (Update agent, a setup), as Check now looks for one. */
    val installing: Boolean,
    /** Check now has it: its check runs, or its engine is not released yet (CheckNow.owns). */
    val checking: Boolean,
    /** The app asked for its terminal and is opening it (HomeStarts, the app in front). */
    val opening: Boolean,
    /** Why its last start failed, while that holds it back (StartHolds); null when none. */
    val failed: String?,
    /** Epoch ms the memory guard last stopped it (MemoryStops); null when it did not. */
    val memoryStopAt: Long?,
    val now: Long,
  )

  /** The mode a message starts an agent of such a kind in; null when it never does. */
  fun mode(speaksAcp: Boolean, wakesByServer: Boolean): EngineMode? = when {
    speaksAcp -> EngineMode.ACP
    wakesByServer -> EngineMode.TERMINAL
    else -> null
  }

  /** Why [look]'s agent may not be started for a message now; null when it may. [room] is asked last, only when all else allows. */
  fun refusal(look: Look, room: () -> String?): String? = when {
    mode(look.speaksAcp, look.wakesByServer) == null -> NEVER
    !look.levelWakes -> "a check found that waking it does not work now"
    look.installing -> "its machine is being updated"
    look.checking -> "Check now is checking it"
    look.opening -> "the user is opening it"
    look.failed != null -> "it failed under ${StartHolds.HOLD_MS / MessageRules.MINUTE_MS} minutes ago (${look.failed})"
    look.memoryStopAt != null && look.now - look.memoryStopAt < MessageRules.MEMORY_STOP_HOLD_MS ->
      "PhoneCanDo stopped it to free memory under ${MessageRules.MEMORY_STOP_HOLD_MS / MessageRules.MINUTE_MS} minutes ago"
    else -> room()
  }

  const val NEVER = "its kind is never started by a message"
}
