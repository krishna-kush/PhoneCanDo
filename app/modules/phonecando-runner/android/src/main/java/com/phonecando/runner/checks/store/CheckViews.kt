package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.CapabilityView
import com.phonecando.runner.checks.CheckRecord
import com.phonecando.runner.checks.CheckState

// The records as one agent reads them, every capability in enum order: one
// it does not declare is OFF; a record of the setting it has now ([key])
// reads as kept; one of another setting, or none, reads UNCHECKED (the
// CLI version is shown, never matched). Pure.
internal object CheckViews {
  fun of(declared: Set<Capability>, key: (Capability) -> String, records: Map<Capability, CheckRecord>): List<CapabilityView> =
    Capability.values().map { capability ->
      val record = current(capability, declared, key, records)
      when {
        capability !in declared -> CapabilityView(capability, CheckState.OFF, null, null, null, null)
        record == null -> CapabilityView(capability, CheckState.UNCHECKED, null, null, null, null)
        else -> CapabilityView(capability, record.state, record.cliVersion, record.at, record.code, record.detail)
      }
    }

  /** The capabilities it declares that are not failed now (LevelNow). */
  fun ok(declared: Set<Capability>, key: (Capability) -> String, records: Map<Capability, CheckRecord>): Set<Capability> =
    declared.filterTo(HashSet()) { current(it, declared, key, records)?.state != CheckState.FAILED }

  // [capability]'s record when it is declared and of the setting it has now.
  private fun current(capability: Capability, declared: Set<Capability>, key: (Capability) -> String, records: Map<Capability, CheckRecord>) =
    records[capability]?.takeIf { capability in declared && it.key == key(capability) }
}
