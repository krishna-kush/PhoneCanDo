package com.phonecando.runner.engine.acp

import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.engine.ready.ReadyProbe

/**
 * An ACP engine is ready once its driver is (AcpAgent: initialized, its
 * chat open, its options set). A start may take as long as the kind's
 * `readiness.output.timeoutSec`, else DEFAULT_TIMEOUT_MS: reopening a
 * long chat replays all of it.
 */
internal class AcpReady(private val ready: () -> Boolean, override val timeoutMs: Long) : ReadyProbe {
  override val intervalMs: Long = INTERVAL_MS

  override fun check(): ReadyProbe.Verdict = if (ready()) ReadyProbe.Verdict.READY else ReadyProbe.Verdict.WAIT

  companion object {
    const val DEFAULT_TIMEOUT_MS = 120_000L
    const val INTERVAL_MS = 100L

    fun timeoutOf(kind: ManifestKind): Long =
      kind.manifest.engine?.readiness?.output?.timeoutSec?.let { it * 1000L } ?: DEFAULT_TIMEOUT_MS
  }
}
