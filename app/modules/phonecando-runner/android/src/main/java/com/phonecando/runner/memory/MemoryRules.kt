package com.phonecando.runner.memory

// Every number the memory guard uses, in one place (MemoryPolicyTest pins
// them). Memory is Android's MemoryInfo: availMem (what can be had without
// killing anything), totalMem and threshold (below which Android starts
// killing background apps; lowMemory is availMem under it).
//
// - warn: availMem under the warn line, max(WARN_PERCENT of total,
//   threshold + WARN_MARGIN)
// - critical: lowMemory, or availMem under threshold + CRITICAL_MARGIN
// - back to ok only once availMem is at least the warn line plus
//   OK_HYSTERESIS_PERCENT of total, so a phone at the line does not flicker
// - a countdown to stopping one agent: WARN_COUNTDOWN_MS from entering
//   warn, at most CRITICAL_COUNTDOWN_MS once critical
// - after a stop, SETTLE_MS for memory to come back, then, still not ok, a
//   fresh NEXT_COUNTDOWN_MS (critical: CRITICAL_COUNTDOWN_MS) for the next
// - one agent per stop; the guard looks every POLL_MS while an engine or a
//   model server runs, and at once when Android reports memory trouble
object MemoryRules {
  const val MIB = 1024L * 1024L

  const val WARN_PERCENT = 12
  const val WARN_MARGIN = 512 * MIB
  const val CRITICAL_MARGIN = 128 * MIB
  const val OK_HYSTERESIS_PERCENT = 4

  const val WARN_COUNTDOWN_MS = 60_000L
  const val CRITICAL_COUNTDOWN_MS = 15_000L
  const val SETTLE_MS = 10_000L
  const val NEXT_COUNTDOWN_MS = 30_000L

  const val POLL_MS = 5_000L

  /** The stopped engine's status error (EngineStatus.error), so the app can say why it stopped. */
  const val STOPPED_REASON = "low_memory: stopped to free memory"
}
