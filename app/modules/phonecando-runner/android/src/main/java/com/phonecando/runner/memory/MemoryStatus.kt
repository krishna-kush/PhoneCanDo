package com.phonecando.runner.memory

// The memory guard's reading as JS sees it (memoryStatus, the
// phonecandoMemory event; PhoneCanDoRunner.types.ts NativeMemoryStatus and
// its parts). Byte counts and times cross the bridge as numbers. Pure.

/** A running engine (starting or ready) and what its processes take; [bytes] null when unread. */
data class MemoryAgent(
  val agentId: String,
  val bytes: Long?,
  val working: Boolean,
  val lastUsedAt: Long?,
  val modelId: String?,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "agentId" to agentId,
    "bytes" to bytes?.toDouble(),
    "working" to working,
    "lastUsedAt" to lastUsedAt?.toDouble(),
    "modelId" to modelId,
  )
}

/** A local model server loading or ready, and the agents holding it. */
data class MemoryModel(
  val modelId: String,
  val name: String,
  val bytes: Long?,
  val agentIds: List<String>,
  val ready: Boolean,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "modelId" to modelId,
    "name" to name,
    "bytes" to bytes?.toDouble(),
    "agentIds" to agentIds,
    "ready" to ready,
  )
}

/** What the runner stopped by itself to free memory, at [at] (epoch ms). */
data class AutoStop(val at: Long, val agentIds: List<String>, val modelIds: List<String>) {
  fun toMap(): Map<String, Any?> = mapOf(
    "at" to at.toDouble(),
    "agentIds" to agentIds,
    "modelIds" to modelIds,
  )
}

data class MemoryStatus(
  val level: MemoryLevel,
  val totalBytes: Long,
  val availBytes: Long,
  /** Below this much free memory the level is warn. */
  val warnBelowBytes: Long,
  /** When the runner stops one agent by itself (epoch ms); null with no countdown. */
  val stopAt: Long?,
  /** The agent the countdown would stop now; null with no countdown. */
  val nextStopAgentId: String?,
  val agents: List<MemoryAgent>,
  val models: List<MemoryModel>,
  val lastAutoStop: AutoStop?,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "level" to level.wire,
    "totalBytes" to totalBytes.toDouble(),
    "availBytes" to availBytes.toDouble(),
    "warnBelowBytes" to warnBelowBytes.toDouble(),
    "stopAt" to stopAt?.toDouble(),
    "nextStopAgentId" to nextStopAgentId,
    "agents" to agents.map { it.toMap() },
    "models" to models.map { it.toMap() },
    "lastAutoStop" to lastAutoStop?.toMap(),
  )
}
