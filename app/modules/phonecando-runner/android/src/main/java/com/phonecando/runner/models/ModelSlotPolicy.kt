package com.phonecando.runner.models

// Whether an agent's start may use the server of its model that is there,
// must start one, or is refused. Several models may be loaded at once, one
// server each, shared by every agent bound to it; the only count is the
// user's cap on loaded models (RunLimits.maxModels). RAM is never a reason
// here: the memory guard (memory/) stops agents when the phone runs short,
// and with their last holder their servers. Pure.
internal object ModelSlotPolicy {
  sealed interface Decision {
    /** The wanted model is up and answers: join it. */
    data object Reuse : Decision

    /** The wanted model is still loading for another agent: refuse (starts run one at a time, so this is rare). */
    data object Loading : Decision

    /** The user's cap on loaded models is reached: refuse. */
    data class Capped(val cap: Int) : Decision

    /** Nothing usable is there: start the wanted model, ending a dead or unheld server of it. */
    data object Start : Decision
  }

  /** The wanted model's server there now. [alive]: its process runs (or is being launched); [ready]: it answered. */
  data class Wanted(val alive: Boolean, val ready: Boolean, val heldByOthers: Boolean)

  /**
   * [wanted]: the wanted model's server, null for none; [othersUp]: the
   * servers of other models loading or ready; [cap]: the user's cap, null
   * for none.
   */
  fun decide(wanted: Wanted?, othersUp: Int, cap: Int?): Decision = when {
    wanted != null && wanted.alive && wanted.ready -> Decision.Reuse
    wanted != null && wanted.alive && wanted.heldByOthers -> Decision.Loading
    cap != null && othersUp >= cap -> Decision.Capped(cap)
    else -> Decision.Start
  }
}
