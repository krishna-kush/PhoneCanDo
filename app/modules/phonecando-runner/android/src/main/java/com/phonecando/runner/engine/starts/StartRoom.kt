package com.phonecando.runner.engine.starts

import com.phonecando.runner.memory.MemoryPolicy
import com.phonecando.runner.memory.MemoryReading
import com.phonecando.runner.memory.MemoryRules

// Whether the phone has room to start one more agent's engine that nobody
// asked for in the app (a message's): memory enough that, once the engine
// takes MemoryRules.START_ROOM, the memory guard is still at ok (so the
// start never begins a countdown that stops someone), and under the cap
// you set on running agents (RunLimits.maxAgents), where such a start is
// refused rather than stopping an idle agent of yours to make room. A
// reading Android would not give is no reason to refuse. Pure.
object StartRoom {
  /** [live]: engines starting or ready; [cap]: the most you let run, null for no cap. */
  data class Look(val reading: MemoryReading?, val live: Int, val cap: Int?)

  /** Why there is no room now, in plain words; null when there is. */
  fun refusal(look: Look): String? {
    val r = look.reading
    return when {
      look.cap != null && look.live >= look.cap -> "${agents(look.live)} running, the most the user set in Settings"
      r != null && (r.lowMemory || r.availBytes - MemoryRules.START_ROOM < MemoryPolicy.lines(r).okFrom) ->
        "the phone is short of memory"
      else -> null
    }
  }

  private fun agents(n: Int) = if (n == 1) "1 agent is" else "$n agents are"
}
