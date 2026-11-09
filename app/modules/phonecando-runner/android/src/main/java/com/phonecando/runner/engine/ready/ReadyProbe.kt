package com.phonecando.runner.engine.ready

/** When a starting engine counts as ready (EngineWatch asks every [intervalMs]). */
internal interface ReadyProbe {
  enum class Verdict {
    READY,
    WAIT,

    /** Another engine answers on our port: ours never bound it (server engines). */
    SQUATTED,
  }

  /** Longest a start may take, from its request. */
  val timeoutMs: Long

  val intervalMs: Long

  fun check(): Verdict
}
