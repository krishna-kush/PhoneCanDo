package com.phonecando.runner.models

// Whether an agent's start may use the model server that is there, must
// wait its turn, or replaces it: one model at a time, shared by every agent
// bound to it. Pure.
internal object ModelSlotPolicy {
  sealed interface Decision {
    /** The wanted model is up and answers: join it. */
    data object Reuse : Decision

    /** Another model serves running agents (or is loading for one): refuse. */
    data class Busy(val loadedModelId: String) : Decision

    /** Nothing usable is there: start the wanted model, ending what was. */
    data object Start : Decision
  }

  /**
   * [loaded]: the model of the server there now, null for none; [ready]: it
   * answered ready; [alive]: its process runs (or is being launched);
   * [others]: the agents other than the asking one that hold it.
   */
  fun decide(loaded: String?, ready: Boolean, alive: Boolean, others: Set<String>, wanted: String): Decision = when {
    loaded == null || !alive -> Decision.Start
    loaded == wanted && ready -> Decision.Reuse
    others.isNotEmpty() -> Decision.Busy(loaded)
    else -> Decision.Start
  }
}
