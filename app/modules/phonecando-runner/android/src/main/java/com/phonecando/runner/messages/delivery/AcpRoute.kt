package com.phonecando.runner.messages.delivery

// Which way an agent's unread set goes, for a kind with an ACP mode
// (manifest `engine.acp`), by what its engine is doing now:
//   ACP mode ready, no turn running, the set may wake it   PROMPT (a prompt: its turn)
//   ACP mode ready, otherwise                             INBOX when its hooks or
//                                                          reader read a folder (a hook may
//                                                          take it mid-turn, or next turn),
//                                                          else NONE (it reads agents_inbox)
//   terminal mode ready, idle, no viewer, no jobs,
//     and the set may wake it                             SWITCH (to ACP mode, then PROMPT)
//   anything else                                         INBOX (as for every other kind)
// Every agent of a kind without an ACP mode goes INBOX. A set that goes to
// the folder of an agent whose engine is in ACP mode never carries the wake
// mark (folderWake): its hooks and reader still run there, and a waiting
// hook or a reader that saw the mark would start a turn outside ACP. In ACP
// mode only a prompt wakes it. Pure.
object AcpRoute {
  enum class Way { INBOX, PROMPT, SWITCH, NONE }

  /** An agent as routing sees it. */
  data class Look(
    /** Its kind has an ACP mode. */
    val speaksAcp: Boolean,
    /** Its engine runs in ACP mode and is ready (AcpEngines.of). */
    val acpReady: Boolean,
    /** Its engine is starting, ready or stopping in ACP mode. */
    val acpMode: Boolean,
    /** An ACP turn is running (a question it asks waits inside one). */
    val acpBusy: Boolean,
    /** Its engine is ready in terminal mode. */
    val terminalReady: Boolean,
    /** No run going and no question waiting (the chat board). */
    val idle: Boolean,
    /** Someone has its terminal open in the app, or Home asked for it and is opening it. */
    val viewer: Boolean,
    /** Jobs it left running (engine/work). */
    val jobs: Boolean,
  ) {
    /** A terminal-mode agent of an ACP kind that may switch to ACP mode now. */
    val canSwitch: Boolean get() = speaksAcp && terminalReady && idle && !viewer && !jobs

    companion object {
      /** A kind without an ACP mode, or no engine at all. */
      val NONE = Look(
        speaksAcp = false, acpReady = false, acpMode = false, acpBusy = false, terminalReady = false, idle = false, viewer = false,
        jobs = false,
      )
    }
  }

  /** [wake]: the set may wake the agent (Parcel.wake); [folder]: its kind's hooks or reader read an inbox folder. */
  fun decide(look: Look, wake: Boolean, folder: Boolean): Way = when {
    look.acpReady -> when {
      wake && !look.acpBusy -> Way.PROMPT
      folder -> Way.INBOX
      else -> Way.NONE
    }
    wake && look.canSwitch -> Way.SWITCH
    else -> Way.INBOX
  }

  /** Whether a set handed to the folder (INBOX) keeps its wake mark: never while the engine is in ACP mode. */
  fun folderWake(look: Look, wake: Boolean): Boolean = wake && !look.acpMode

  /** Whether a wake can take the agent now as far as ACP goes: idle in ACP mode, or free to switch to it. */
  fun readyToWake(look: Look): Boolean = (look.acpReady && !look.acpBusy) || look.canSwitch
}
