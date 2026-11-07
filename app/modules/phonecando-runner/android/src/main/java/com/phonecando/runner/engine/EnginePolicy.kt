package com.phonecando.runner.engine

// How many engines run at once, and which one gives way. At most
// MAX_RUNNING engines start or serve together; a further start stops the
// least recently used READY engine that has been idle IDLE_MS, and is
// refused when none has. Engines already stopping do not count. Pure.
object EnginePolicy {
  const val MAX_RUNNING = 3
  const val IDLE_MS = 60_000L

  /** One engine that holds a seat. [ready]: serving (a starting one is never idle). */
  data class Seat(val agentId: String, val lastUsedAt: Long, val ready: Boolean)

  sealed class Admission {
    object Admit : Admission()

    data class Evict(val agentId: String) : Admission()

    object Reject : Admission()
  }

  fun admit(seats: List<Seat>, now: Long, cap: Int = MAX_RUNNING, idleMs: Long = IDLE_MS): Admission {
    if (seats.size < cap) return Admission.Admit
    val idle = seats.filter { it.ready && now - it.lastUsedAt >= idleMs }
    return idle.minByOrNull { it.lastUsedAt }?.let { Admission.Evict(it.agentId) } ?: Admission.Reject
  }
}
