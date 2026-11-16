package com.phonecando.runner.checks.now

// Why a Check now, or one of its rows, didn't finish, as the run's detail
// or the row's why says it. Pure.
object CheckRunCopy {
  /** In ACP mode, nothing moved for STUCK_MS while it was on [words] (CheckRun.Step.words); [left]: a view shows its terminal, so we left it running. */
  fun stuck(words: String, left: Boolean): String = if (left) {
    "Nothing moved for 3 minutes ($words). We left it open on your screen: it may need you to sign in."
  } else {
    "Nothing moved for 3 minutes ($words), so we stopped it to free memory. Open the agent: it may need you to sign in."
  }

  /** It ran CHECK_MAX_MS without finishing. */
  fun tooLong(left: Boolean): String = if (left) {
    "It ran for 30 minutes without finishing. We left it open on your screen."
  } else {
    "It ran for 30 minutes without finishing, so we stopped it to free memory."
  }

  const val ENGINE_FAILED = "Its engine ended before the check task finished."
  const val STOPPED = "It stopped before the check task finished."

  /** You stopped its check task (a cancelled run's detail). */
  const val YOU_STOPPED = "You stopped its check task, so the check ended there."

  /** A row no part can test: a part with no task runs no turn in its own app. */
  const val SKIPPED = "Needs a turn in its own app; checked the first time you use it."

  /** A row with no verdict GRACE_MS after its part's turn end. */
  const val UNKNOWN_AFTER_TURN = "Couldn't tell from this turn."

  /** A row with no verdict GRACE_MS after its part's turn ended with an error. */
  const val UNKNOWN_FAILED = "Couldn't tell: its turn ended with an error."

  /** A row with no verdict GRACE_MS after its part's turn was stopped. */
  const val UNKNOWN_STOPPED = "Couldn't tell: its turn was stopped."

  /** A row with no verdict once a part with no task had its time. */
  const val UNKNOWN_NO_TURN = "Couldn't tell without a turn in its own app."

  /** A row still testing when the run got stuck, was cancelled or failed. */
  const val UNKNOWN_CUT = "Couldn't tell: its turn didn't end."

  /** A row of a part the run never got to. */
  const val UNKNOWN_NOT_REACHED = "Couldn't tell: the check stopped before this part."
}
