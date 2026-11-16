package com.phonecando.models.api

import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.RamShare
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.models.memory.MemoryTraits
import com.phonecando.models.memory.MemoryView

// The JS shapes of a model's Memory setting (MemoryChoices, MemoryPlan and
// ModelTraits in app/src/engine/models/types.ts). Choices go by lower-case
// name; a number left out or null is Auto.

/** `{ ramShare, kvCache, savedPrompts, checkpoints, threads }`, the detailed log aside (its own switch). */
internal fun ServeChoices.toMap(): Map<String, Any?> = mapOf(
  "ramShare" to ramShare.name.lowercase(),
  "kvCache" to kvCache.name.lowercase(),
  "savedPrompts" to savedPrompts,
  "checkpoints" to checkpoints,
  "threads" to threads,
)

/** The choices JS sends; [detailedLog] is kept from the record (the Server log page sets it). */
internal fun serveChoices(raw: Map<String, Any?>, detailedLog: Boolean): ServeChoices {
  fun count(key: String): Int? = when (val v = raw[key]) {
    null -> null
    is Number -> v.toDouble().also { require(it == Math.floor(it)) { "$key is a whole number" } }.toInt()
    else -> throw IllegalArgumentException("$key is a number")
  }
  return ServeChoices(
    ramShare = choice(raw["ramShare"], RamShare.entries, RamShare.NORMAL, "ramShare"),
    kvCache = choice(raw["kvCache"], KvCacheChoice.entries, KvCacheChoice.AUTO, "kvCache"),
    savedPrompts = count("savedPrompts"),
    checkpoints = count("checkpoints"),
    threads = count("threads"),
    detailedLog = detailedLog,
  )
}

private fun <E : Enum<E>> choice(raw: Any?, entries: List<E>, auto: E, key: String): E = when (raw) {
  null -> auto
  is String -> entries.firstOrNull { it.name.lowercase() == raw } ?: throw IllegalArgumentException("$key is one of ${entries.joinToString { it.name.lowercase() }}")
  else -> throw IllegalArgumentException("$key is a name")
}

internal fun MemoryView.toMap(): Map<String, Any?> = mapOf(
  "context" to context.toDouble(),
  "halfKvCache" to halfKvCache,
  "savedPrompts" to savedPrompts,
  "checkpoints" to checkpoints,
  "threads" to threads,
  "totalBytes" to totalBytes.toDouble(),
  "freeMemoryLimits" to freeMemoryLimits,
  "ram" to ram.toMap(),
  "storedChats" to storedChats,
  "measured" to measured,
)

internal fun MemoryTraits.toMap(): Map<String, Any?> = mapOf(
  "savedPrompts" to savedPrompts.toMap(),
  "checkpoints" to checkpoints?.toMap(),
  "halfKvCache" to halfKvCache,
  "threads" to threads.toMap(),
  "budgets" to budgets.entries.associate { (share, bytes) -> share.name.lowercase() to bytes.toDouble() },
)

private fun MemoryTraits.Choice.toMap(): Map<String, Any?> = mapOf("min" to range.first, "max" to range.last, "auto" to auto)
