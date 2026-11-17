package com.phonecando.runner.update

import com.phonecando.network.download.Sha256

/**
 * Where an update download is, as JS reads it (`step` on the state map):
 * bytes coming in, an earlier partial read back before it goes on, a wait
 * before another try, a wait for a network, or how it ended. Pure.
 */
enum class UpdateStep(val wire: String, val running: Boolean) {
  DOWNLOAD("download", true),
  VERIFY("verify", true),
  RETRY("retry", true),
  OFFLINE("offline", true),
  DONE("done", false),
  FAILED("failed", false),
  STOPPED("stopped", false),
  ;

  companion object {
    fun of(wire: String?): UpdateStep? = entries.firstOrNull { it.wire == wire }

    /**
     * The step for one of network's progress reports: re-hashing a partial
     * an earlier try left is [VERIFY]; FileDownloader's bytes, and any step
     * network adds later, are [DOWNLOAD].
     */
    fun ofProgress(step: String): UpdateStep = if (step == Sha256.VERIFY) VERIFY else DOWNLOAD
  }
}
