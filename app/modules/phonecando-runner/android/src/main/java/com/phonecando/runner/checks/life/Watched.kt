package com.phonecando.runner.checks.life

import com.phonecando.agents.kit.Capability
import com.phonecando.runner.checks.rules.Life
import java.util.concurrent.Future

// One life as the watcher follows it: the rules' Life, and what a record
// from it needs (the kind, each declared capability's setting key, the
// CLI version it runs), how to look at its state folder (S6) and its
// screen (S5), and the secrets a detail must never show. Touched only on
// the watcher's thread.
internal class Watched(
  val life: Life,
  val kindId: String,
  val keys: Map<Capability, String>,
  /** The agent's installedVersion, empty when none. */
  val cliVersion: String,
  /** S6; null when the agent keeps no state of its own. */
  val state: StateProbe?,
  /** The end of its TUI's screen ring now; null: none (yet). */
  val screen: () -> ByteArray?,
  /** Its password and bridge token: a quoted screen line never shows them. */
  val secrets: List<String>,
) {
  /** A terminal turn is going: WORKING came and no turn end since, so a FAILED or STOPPED event ends it. */
  var working = false

  /** The S5 look while it runs. */
  var poll: Future<*>? = null

  /** What each capability was last recorded as in this life ("<failed>|<code>"), so a finding goes out once per life. */
  val recorded = HashMap<Capability, String>()
}
