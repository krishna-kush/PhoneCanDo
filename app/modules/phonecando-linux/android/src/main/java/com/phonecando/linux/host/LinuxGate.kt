package com.phonecando.linux.host

import com.phonecando.linux.LinuxStatus
import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode

/**
 * Refusals for every Linux path: play ships no Linux, and a build missing
 * the launcher, proot or its loader cannot run it. The Default env also
 * needs the baked image asset (absent in a dev build until staged).
 * Android envs and images never pass through here. Pure.
 */
object LinuxGate {
  /** @throws LinuxError linux_unavailable with the status' reason. */
  fun requireLinux(status: LinuxStatus) {
    if (!status.available) throw LinuxError(LinuxErrorCode.LINUX_UNAVAILABLE, "Linux is unavailable: ${status.reason}")
  }

  /** [requireLinux], then the Default image asset. */
  fun requireDefaultImage(status: LinuxStatus, assetPresent: Boolean) {
    requireLinux(status)
    if (!assetPresent) {
      throw LinuxError(
        LinuxErrorCode.LINUX_UNAVAILABLE,
        "the Default image is not in this build (stage it with lre/images/default/lock/stage.sh)",
      )
    }
  }
}
