package com.phonecando.runner.limits

import kotlin.math.roundToLong

// The user's caps on what runs at once (Settings): how many agents' engines
// may start or serve together (EnginePolicy) and how many local model
// servers may be loaded (ModelSlotPolicy). null: no cap, the default; the
// memory guard (memory/) looks after RAM either way. A cap is a whole
// number from MIN to MAX: what JS sends is rounded and clamped, and
// anything that is not a finite number is no cap. JS sees
// {maxAgents, maxModels} (PhoneCanDoRunner.types.ts NativeRunLimits). Pure.
data class RunLimits(val maxAgents: Int?, val maxModels: Int?) {
  fun toMap(): Map<String, Any?> = mapOf(
    "maxAgents" to maxAgents?.toDouble(),
    "maxModels" to maxModels?.toDouble(),
  )

  companion object {
    const val MIN = 1
    const val MAX = 99
    val NONE = RunLimits(null, null)

    /** A cap as kept: null stays null, a number is rounded into MIN..MAX, NaN or an infinity is no cap. */
    fun cap(value: Double?): Int? {
      if (value == null || !value.isFinite()) return null
      return value.roundToLong().coerceIn(MIN.toLong(), MAX.toLong()).toInt()
    }

    /** A cap read back from storage: one outside MIN..MAX is no cap (never written by us). */
    fun stored(value: Int?): Int? = value?.takeIf { it in MIN..MAX }

    /** JS's {maxAgents, maxModels}; a missing key or a value that is not a number is no cap. */
    fun fromJs(map: Map<String, Any?>): RunLimits = RunLimits(
      cap((map["maxAgents"] as? Number)?.toDouble()),
      cap((map["maxModels"] as? Number)?.toDouble()),
    )
  }
}
