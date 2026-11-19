package com.phonecando.runner.presence

// How the note to go on after a hand-over (Start me again, Your turn)
// reaches an agent whose engine runs, row by row:
//   a run going or a question waiting, or starting   NOTICE (its hooks take it mid-turn,
//                                                     or at the turn's end)
//   idle in ACP mode                                  NOTICE (the mailbox prompts it)
//   idle, its kind's own wake is ready (a waiting
//     hook, a reader)                                 NOTICE (it takes it in place)
//   idle, jobs left running                           NOTICE (a restart or switch would end
//                                                     them: it reads it at its next turn)
//   idle in its terminal, a kind that starts with
//     a prompt and resumes its last chat              RESTART (stopped and started again in
//                                                     the same chat, the note its first prompt)
//   idle in its terminal, an ACP kind whose ACP
//     mode lists its chats                            SWITCH (the terminal stopped, then ACP mode
//                                                     with the note as its first prompt, in the
//                                                     chat the terminal left: the newest it
//                                                     lists, AcpChats)
//   anything else                                     WAIT (the note with no wake: it reads it
//                                                     at its next turn)
// RESTART and SWITCH are for a TUI that can't be woken while idle (Codex;
// Kimi Code, whose TUI takes no first prompt): a notice alone would sit in
// its inbox until you typed. Both go on in the chat it was in, as a
// message's switch to ACP mode would not always: an ACP mode that lists no
// chats (Gemini CLI) can only start a new one, which knows nothing of the
// task, so that kind's note WAITs with no wake, or the mailbox would
// switch it into one (AcpListing says which lists, as each kind's ACP mode
// last started). Unlike a scheduled task (schedule/FireRules), an open
// terminal or PhoneCanDo in front is no reason to wait: you asked for it.
// Pure.
object ResumeRules {
  enum class Way { NOTICE, RESTART, SWITCH, WAIT }

  data class State(
    /** Its engine is ready (not starting or stopping). */
    val ready: Boolean,
    /** No run going and no question waiting. */
    val idle: Boolean,
    /** Its engine runs in ACP mode. */
    val acpMode: Boolean,
    /** Its kind's own wake (`inbox.wake`) can wake it now: a hook waits, or a reader. */
    val kindWakes: Boolean,
    /** It left jobs running, or is kept running. */
    val jobs: Boolean,
    /** Its kind starts its TUI with a first prompt and has resume args. */
    val restartable: Boolean,
    /** Its kind has an ACP mode (`engine.acp`). */
    val acpKind: Boolean,
    /** Its kind's ACP mode listed its chats when it last started (AcpListing). */
    val acpLists: Boolean,
  )

  fun decide(s: State): Way = when {
    !s.ready || !s.idle -> Way.NOTICE
    s.acpMode -> Way.NOTICE
    s.kindWakes -> Way.NOTICE
    s.jobs -> Way.NOTICE
    s.restartable -> Way.RESTART
    s.acpKind && s.acpLists -> Way.SWITCH
    else -> Way.WAIT
  }
}
