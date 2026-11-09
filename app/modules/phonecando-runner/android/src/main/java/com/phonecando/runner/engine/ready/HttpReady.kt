package com.phonecando.runner.engine.ready

import com.phonecando.agents.kit.HttpProbe

// A server engine is ready once its health probe, sent with this agent's
// password, answers 200; a 401 means another engine answers on this port.
// No answer at all is still booting.
internal class HttpReady(private val probe: HttpProbe) : ReadyProbe {
  override val timeoutMs: Long = BOOT_TIMEOUT_MS
  override val intervalMs: Long = INTERVAL_MS

  override fun check(): ReadyProbe.Verdict {
    val status = try {
      probe.status(CONNECT_TIMEOUT_MS, READ_TIMEOUT_MS)
    } catch (_: Exception) {
      return ReadyProbe.Verdict.WAIT
    }
    return when (status) {
      200 -> ReadyProbe.Verdict.READY
      401 -> ReadyProbe.Verdict.SQUATTED
      else -> ReadyProbe.Verdict.WAIT
    }
  }

  private companion object {
    // A first boot on a slow phone can take a while; past this the start
    // counts as failed and the supervisor stops the engine.
    const val BOOT_TIMEOUT_MS = 120_000L
    const val INTERVAL_MS = 250L
    const val CONNECT_TIMEOUT_MS = 1_000
    const val READ_TIMEOUT_MS = 3_000
  }
}
