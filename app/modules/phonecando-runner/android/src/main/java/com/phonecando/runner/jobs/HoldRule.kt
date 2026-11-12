package com.phonecando.runner.jobs

// When the jobs anchor asks for our foreground service (JobsAnchor). It
// asks once while jobs run and the service is down; a refused ask (Android
// lets a background app start none) is tried again only when another job
// begins, not on every progress tick. Pure.
internal object HoldRule {
  /**
   * [asked]: a start is on its way; [refused]: the last ask was refused;
   * [seen]: the jobs running at the last look, by key.
   */
  data class State(
    val asked: Boolean = false,
    val refused: Boolean = false,
    val seen: Set<String> = emptySet(),
  )

  data class Step(val state: State, val ask: Boolean)

  /** The jobs changed: [running] are the keys of those running now. */
  fun onJobs(state: State, running: Set<String>, serviceUp: Boolean): Step {
    if (running.isEmpty()) return Step(State(), false)
    val began = !state.seen.containsAll(running)
    val ask = !serviceUp && !state.asked && (!state.refused || began)
    val next = state.copy(asked = state.asked || ask, refused = state.refused && !began, seen = running)
    return Step(next, ask)
  }

  /** The ask threw: Android refused the start. */
  fun refused(state: State): State = state.copy(asked = false, refused = true)

  /** The service started (it holds while jobs run) or ended (the next job event may ask again). */
  fun serviceChanged(state: State): State = state.copy(asked = false, refused = false)
}
