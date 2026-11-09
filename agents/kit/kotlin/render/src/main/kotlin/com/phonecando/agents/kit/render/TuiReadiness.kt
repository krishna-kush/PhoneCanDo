package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Readiness

/** When a TUI engine counts as ready (`engine.readiness`), with our defaults for what the manifest leaves out. */
sealed interface TuiReadiness {
  /** After its first output and then [settleMs] of quiet; a start with none within [timeoutMs] fails. */
  data class Output(val settleMs: Long, val timeoutMs: Long) : TuiReadiness

  /** Once it has run [ms]. */
  data class Alive(val ms: Long) : TuiReadiness

  companion object {
    const val SETTLE_MS = 400L
    const val TIMEOUT_SEC = 60L
    const val ALIVE_MS = 1_000L

    /** No readiness at all: after the first output. */
    fun of(readiness: Readiness?): TuiReadiness {
      readiness?.alive?.let { return Alive(it.ms?.toLong() ?: ALIVE_MS) }
      val output = readiness?.output
      return Output(output?.settleMs?.toLong() ?: SETTLE_MS, (output?.timeoutSec?.toLong() ?: TIMEOUT_SEC) * 1000L)
    }
  }
}
