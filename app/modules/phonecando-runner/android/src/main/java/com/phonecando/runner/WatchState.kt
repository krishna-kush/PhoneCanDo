package com.phonecando.runner

// Which sessions are generating right now. Pure Kotlin, zero Android imports:
// feed it parsed engine events, ask who is working. Started/part/text events
// mark working; finished/failed/gone clear. Unknown sessions are learned on
// first sight (a step can start before any UI report names it).
class WatchState {
  private val working = mutableSetOf<String>()

  /** Feed one parsed event. Returns true when the working set changed. */
  fun apply(kind: EngineEvent.Kind, sessionId: String?): Boolean {
    if (sessionId == null) return false
    return when (kind) {
      EngineEvent.Kind.WORKING -> working.add(sessionId)
      EngineEvent.Kind.FINISHED,
      EngineEvent.Kind.FAILED,
      EngineEvent.Kind.GONE,
      -> working.remove(sessionId)
      EngineEvent.Kind.OTHER -> false
    }
  }

  fun isWorking(sessionId: String): Boolean = working.contains(sessionId)

  fun workingIds(): Set<String> = working.toSet()

  fun drop(sessionId: String): Boolean = working.remove(sessionId)

  fun clear() = working.clear()
}
