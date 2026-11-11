package com.phonecando.runner.engine

// How many engines run at once, and which one gives way. With no cap (the
// default) every start is admitted: the memory guard (memory/) stops one
// when the phone runs short. With the user's cap (RunLimits.maxAgents) at
// most that many engines start or serve together; a further start stops
// the least recently used READY engine that has been idle IDLE_MS, and is
// refused when none has. A cap lowered below what runs now stops nothing:
// it applies to the next start. Engines already stopping do not count.
// Pure.
object EnginePolicy {
  const val IDLE_MS = 60_000L

  /** One engine that holds a seat. [ready]: serving (a starting one is never idle). */
  data class Seat(val agentId: String, val lastUsedAt: Long, val ready: Boolean)

  sealed class Admission {
    object Admit : Admission()

    data class Evict(val agentId: String) : Admission()

    object Reject : Admission()
  }

  /** [cap] null: no cap. */
  fun admit(seats: List<Seat>, now: Long, cap: Int?, idleMs: Long = IDLE_MS): Admission {
    if (cap == null || seats.size < cap) return Admission.Admit
    val idle = seats.filter { it.ready && now - it.lastUsedAt >= idleMs }
    return idle.minByOrNull { it.lastUsedAt }?.let { Admission.Evict(it.agentId) } ?: Admission.Reject
  }
}
