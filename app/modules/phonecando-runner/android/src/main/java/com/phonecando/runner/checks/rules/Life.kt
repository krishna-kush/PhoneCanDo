package com.phonecando.runner.checks.rules

import com.phonecando.runner.engine.EngineMode

// One engine life of an agent, from a launch to its end (an exit, a stop,
// a failed start, or a relaunch, which starts a life of its own), and what
// it showed so far. CheckRules notes the signals here and decides from
// them. Not thread-safe: the watcher keeps it on its one thread. Pure.
internal class Life(
  val agentId: String,
  val facts: KindFacts,
  val mode: EngineMode,
  /** The first prompt it was launched with (a task); null: none. */
  val prompt: String?,
  /** It was launched on the chat ACP mode left (LaunchPlan.chatId). */
  val chat: Boolean,
  /** Epoch ms of the launch. */
  val launchedAt: Long,
) {
  /** What S5 looks for on its screen (ScreenText.needle); null without a prompt. */
  val needle: String? = prompt?.let(ScreenText::needle)

  /** Until it ends; a decision that needs it up checks this. */
  var up = true
  var ready = false

  /** S1: a bridge request with its token. */
  var contact = false

  /** S2: the inbox hook events that reported they ran, without `wait`. */
  val hooks = HashSet<String>()

  /** S2 with `wait`: its waiting hook started. */
  var waited = false

  /** S3: an `@inbox` receipt. */
  var receipt = false

  /** It raised an activity event (anything but OTHER, or a new session). */
  var activity = false

  var turnEnds = 0

  /** Its task showed: a WORKING event or the task on its screen. */
  var taskSeen = false

  /** The ids of the last wake-marked set written while it was up and still unanswered; null: none. */
  var wakeSet: List<Long>? = null
}
