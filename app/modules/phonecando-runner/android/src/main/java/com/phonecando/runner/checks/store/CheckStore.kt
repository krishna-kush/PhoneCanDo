package com.phonecando.runner.checks.store

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.schedule.StateFile

// The records' file, files/state/checks.json (CheckJson), written whole and
// atomically (StateFile). Missing or unreadable reads as none.
internal class CheckStore(private val file: StateFile) {
  fun load(): Map<String, Map<Capability, Stored>> = file.read()?.let(CheckJson::decode).orEmpty()

  /** Throws IOException. */
  fun save(kinds: Map<String, Map<Capability, Stored>>) = file.write(CheckJson.encode(kinds))

  companion object {
    /** Under the app's files dir. */
    const val PATH = "state/checks.json"
  }
}
