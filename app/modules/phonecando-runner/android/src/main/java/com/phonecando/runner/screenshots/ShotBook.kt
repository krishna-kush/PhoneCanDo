package com.phonecando.runner.screenshots

// Which screenshots agents' looks left on disk, and when each goes. Every
// agent on the phone runs as one Android user and can read the folder they
// land in, so a screenshot lives only while its agent needs it: its next
// one replaces it, and it goes when another agent gets the screen, when its
// agent hands the phone back or stops, and after MAX_AGE_MS. Each call
// answers the paths to delete. Pure: the clock is the caller's.
class ShotBook(private val maxAgeMs: Long = MAX_AGE_MS) {
  private data class Shot(val agentId: String, val at: Long)

  private val shots = LinkedHashMap<String, Shot>()

  /** [agentId] took [path] at [now]: its earlier ones go, and any too old. */
  @Synchronized
  fun taken(agentId: String, path: String, now: Long): List<String> {
    val gone = drop { it.agentId == agentId || now - it.at >= maxAgeMs }
    shots[path] = Shot(agentId, now)
    return gone
  }

  /** [agentId] got the screen: every other agent's go. */
  @Synchronized
  fun screenTo(agentId: String): List<String> = drop { it.agentId != agentId }

  /** [agentId] handed the phone back or stopped. */
  @Synchronized
  fun ended(agentId: String): List<String> = drop { it.agentId == agentId }

  @Synchronized
  fun expired(now: Long): List<String> = drop { now - it.at >= maxAgeMs }

  @Synchronized
  fun all(): List<String> = drop { true }

  private fun drop(which: (Shot) -> Boolean): List<String> {
    val gone = shots.filterValues(which).keys.toList()
    gone.forEach(shots::remove)
    return gone
  }

  companion object {
    const val MAX_AGE_MS = 5 * 60_000L
  }
}
