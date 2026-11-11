package com.phonecando.runner.memory

/** The phone's memory now, as Android's ActivityManager.MemoryInfo says (SystemMemory). */
data class MemoryReading(
  val totalBytes: Long,
  /** What can be had without killing anything. */
  val availBytes: Long,
  /** Below this availMem Android starts killing background apps. */
  val thresholdBytes: Long,
  /** availMem is under the threshold. */
  val lowMemory: Boolean,
)

/** How close the phone is to running out; [wire] is what JS sees (NativeMemoryLevel). */
enum class MemoryLevel(val wire: String) {
  OK("ok"),

  /** Near the peak: a countdown to stopping one agent. */
  WARN("warn"),

  /** Android is about to kill processes: a short countdown. */
  CRITICAL("critical"),
}
