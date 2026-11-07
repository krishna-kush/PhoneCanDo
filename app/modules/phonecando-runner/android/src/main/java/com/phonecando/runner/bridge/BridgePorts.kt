package com.phonecando.runner.bridge

// Which loopback ports the bridge tries, in order: the last one it bound
// (engines that outlived a service restart still hold that URL), the fixed
// door, then any free port the OS assigns (0). A taken door must not strand
// the bridge. Pure.
object BridgePorts {
  const val PREFERRED = 9998

  fun candidates(lastGood: Int): List<Int> =
    (listOfNotNull(lastGood.takeIf { it in 1024..65535 }) + PREFERRED + 0).distinct()
}
