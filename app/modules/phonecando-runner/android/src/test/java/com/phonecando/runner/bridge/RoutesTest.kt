package com.phonecando.runner.bridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Route table: which routes take the screen lease, which are gated, which
// exist only in full, the telemetry keys, and the ports the bridge tries.
class RoutesTest {
  @Test fun screenRoutes() {
    val screen = Route.entries.filter { it.screen }.map { it.path }.toSet()
    assertEquals(setOf("/pce/observe", "/pce/act", "/pce/pack", "/open", "/share", "/app"), screen)
  }

  @Test fun gatedAndFullOnlyRoutes() {
    val gated = Route.entries.filter { it.gated }.map { it.path }.toSet()
    assertEquals(
      setOf("/notify", "/share", "/open", "/clipboard", "/pce/describe", "/pce/observe", "/pce/act", "/pce/pack"),
      gated,
    )
    val fullOnly = Route.entries.filter { it.fullOnly }.map { it.path }.toSet()
    assertEquals(
      setOf("/unlock", "/accessibility", "/pce/describe", "/pce/observe", "/pce/act", "/pce/pack"),
      fullOnly,
    )
    assertEquals(Route.entries.filter { it.path.startsWith("/pce/") }, Route.entries.filter { it.pce })
  }

  @Test fun lookupNeedsTheRightMethod() {
    assertEquals(Route.PING, Route.find("GET", "/ping"))
    assertEquals(Route.PCE_ACT, Route.find("POST", "/pce/act"))
    assertNull(Route.find("GET", "/notify"))
    assertNull(Route.find("POST", "/pce/describe"))
    assertNull(Route.find("GET", "/ui/screen"))
  }

  @Test fun telemetryKeysAreRouteNames() {
    assertEquals("pce_act", Route.telemetryKey("/pce/act"))
    assertEquals("accessibility", Route.telemetryKey("/accessibility"))
    assertEquals("keep", Route.telemetryKey("/keep"))
    assertNull(Route.telemetryKey("/nope"))
  }

  @Test fun portsPreferTheLastGoodOne() {
    assertEquals(listOf(41234, 9998, 0), BridgePorts.candidates(41234))
    assertEquals(listOf(9998, 0), BridgePorts.candidates(9998))
    assertEquals(listOf(9998, 0), BridgePorts.candidates(0))
    assertEquals(listOf(9998, 0), BridgePorts.candidates(80))
  }
}
