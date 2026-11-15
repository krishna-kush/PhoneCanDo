package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.CheckRecord
import com.phonecando.runner.checks.CheckState

/** A kept record and the failure it last notified about ("<key>|<cliVersion>|<code>"; null: none yet). */
internal data class Stored(val record: CheckRecord, val notified: String?)

// The records, one per kind and capability, in memory (CheckStore keeps
// them in files/state/checks.json). The newest signal wins: a success
// replaces a failure and a failure a success. The same finding again (same
// state, setting key and code) keeps its first detail and only moves on
// `at`, `cliVersion` and `agentId`. A failure is the first of its kind when
// its "<key>|<cliVersion>|<code>" differs from the one last notified,
// which it then becomes: one notification per setting, CLI version and
// failure. Thread-safe. Pure.
internal class CheckBook {
  /** A record put: as kept now, and whether to notify about it. */
  data class Put(val record: CheckRecord, val firstFailure: Boolean)

  private val kinds = HashMap<String, HashMap<Capability, Stored>>()

  @Synchronized
  fun load(saved: Map<String, Map<Capability, Stored>>) {
    kinds.clear()
    for ((kindId, records) in saved) kinds[kindId] = HashMap(records)
  }

  @Synchronized
  fun put(kindId: String, capability: Capability, record: CheckRecord): Put {
    val records = kinds.getOrPut(kindId) { HashMap() }
    val old = records[capability]
    val kept = old?.record?.takeIf { it.state == record.state && it.key == record.key && it.code == record.code }
    val next = kept?.copy(at = record.at, cliVersion = record.cliVersion, agentId = record.agentId) ?: record
    var notified = old?.notified
    var first = false
    if (next.state == CheckState.FAILED) {
      val tag = "${next.key}|${next.cliVersion}|${next.code}"
      if (tag != notified) {
        first = true
        notified = tag
      }
    }
    records[capability] = Stored(next, notified)
    return Put(next, first)
  }

  /** [kindId]'s records, by capability. */
  @Synchronized
  fun of(kindId: String): Map<Capability, CheckRecord> = kinds[kindId]?.mapValues { it.value.record }.orEmpty()

  /** Everything, for the file. */
  @Synchronized
  fun all(): Map<String, Map<Capability, Stored>> = kinds.mapValues { HashMap(it.value) }
}
