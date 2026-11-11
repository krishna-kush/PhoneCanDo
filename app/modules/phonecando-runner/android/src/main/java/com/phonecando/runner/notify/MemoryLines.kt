package com.phonecando.runner.notify

// The memory guard's notifications in words (MemoryNotices): the warning
// while memory is short, and what we stopped to free some. Pure.
internal object MemoryLines {
  const val WARN_TITLE = "Running low on memory"
  const val STOPPED_TITLE = "Freed up some memory"

  /** [stopInMs]: until we stop one ourselves; null with no countdown (nothing we may stop). */
  fun warn(stopInMs: Long?): String {
    val start = "Your phone is running out of memory."
    return when {
      stopInMs == null -> "$start Stop an agent or two to give it some room."
      stopInMs >= SOON_MS -> "$start Stop an agent or two, or we'll tuck the sleepiest one in for you in a minute."
      else -> "$start Stop an agent or two, or we'll tuck the sleepiest one in for you in a moment."
    }
  }

  /** [names]: the agents stopped so far in this stretch of low memory, oldest first. */
  fun stopped(names: List<String>): String {
    val them = if (names.size == 1) "it" else "them"
    return "We stopped ${list(names)} to free memory. Start $them again whenever you like."
  }

  /** "A", "A and B", "A, B and C". */
  fun list(names: List<String>): String = when (names.size) {
    0 -> "an agent"
    1 -> names[0]
    else -> names.dropLast(1).joinToString(", ") + " and " + names.last()
  }

  private const val SOON_MS = 45_000L
}
