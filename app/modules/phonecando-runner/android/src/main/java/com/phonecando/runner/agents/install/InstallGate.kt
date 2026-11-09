package com.phonecando.runner.agents.install

import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException

// Whether an agent may start as far as its install goes: a kind with an
// install block is installed into each agent's image first, so its agent
// starts only once that install is recorded (recordInstall). A kind
// without one starts as it always did. Pure.
internal object InstallGate {
  fun needsInstall(kind: ManifestKind, record: AgentRecord): Boolean =
    kind.hasInstall && record.installedVersion == null

  /** Throws agent_not_installed while [record] needs its install. */
  fun check(kind: ManifestKind, record: AgentRecord) {
    if (needsInstall(kind, record)) {
      throw EngineStartException(EngineStartError.AGENT_NOT_INSTALLED, "${kind.displayName} is not installed in its machine yet")
    }
  }
}
