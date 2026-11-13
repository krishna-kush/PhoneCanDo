package com.phonecando.runner.schedule

// What a due task does with its agent as it is now, row by row:
//   kind has neither a start prompt nor a wake          UNSUPPORTED (refused when set; failed here)
//   engine stopped, kind takes a prompt at start         START_WITH_PROMPT
//   engine stopped, kind wakes through its server        START_THEN_WAKE
//   engine starting or stopping, or ready and busy       WAIT_IDLE (decided again once idle; busy after BUSY_WAIT)
//   ready, idle, can be woken now, chat SAME or a server kind   WAKE
//   ready, idle, takes a prompt at start, no jobs, app not in front   RESTART_WITH_PROMPT
//   otherwise                                            ASK_USER
// Busy is a run going or a question waiting. Pure.
object FireRules {
  enum class Engine { STOPPED, STARTING, READY, STOPPING }

  enum class Action { START_WITH_PROMPT, START_THEN_WAKE, WAIT_IDLE, WAKE, RESTART_WITH_PROMPT, ASK_USER, UNSUPPORTED }

  data class State(
    val engine: Engine,
    /** Ready, with no run going and no question waiting. */
    val idle: Boolean,
    /** The kind starts its TUI with a first prompt (`engine.prompt`). */
    val kindPrompts: Boolean,
    /** The kind can be woken at all (`inbox.wake`: server, hook or reader). */
    val kindWakes: Boolean,
    /** It wakes through its own server (`inbox.wake` server). */
    val wakesByServer: Boolean,
    /** It can be woken now: a hook kind's hook is waiting (AgentsView.wakeReady). */
    val wakeReady: Boolean,
    val chat: ChatMode,
    /** Jobs it left running (engine/work): a restart would end them. */
    val jobs: Boolean,
    val appInFront: Boolean,
  )

  fun decide(s: State): Action {
    if (!s.kindPrompts && !s.kindWakes) return Action.UNSUPPORTED
    return when (s.engine) {
      Engine.STOPPED -> when {
        s.kindPrompts -> Action.START_WITH_PROMPT
        s.wakesByServer -> Action.START_THEN_WAKE
        else -> Action.ASK_USER
      }
      Engine.STARTING, Engine.STOPPING -> Action.WAIT_IDLE
      Engine.READY -> when {
        !s.idle -> Action.WAIT_IDLE
        s.kindWakes && s.wakeReady && (s.chat == ChatMode.SAME || s.wakesByServer) -> Action.WAKE
        s.kindPrompts && !s.jobs && !s.appInFront -> Action.RESTART_WITH_PROMPT
        else -> Action.ASK_USER
      }
    }
  }

  /** Whether the kind can run schedules at all (KindView `schedules`, kindRunsSchedules). */
  fun kindRuns(kindPrompts: Boolean, kindWakes: Boolean): Boolean = kindPrompts || kindWakes
}
