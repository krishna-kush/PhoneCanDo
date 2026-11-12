package com.phonecando.runner.engine

import com.phonecando.agents.kit.render.GuestEnvPolicy
import com.phonecando.agents.kit.render.ImageLaunch
import com.phonecando.agents.kit.term.TermTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

// JVM checks for the engine environment's layers, the agent tag, a TUI's
// terminal values and what an image kind's engine carries past its
// machine's launch.conf.
class EngineEnvTest {
  private val base = mapOf("PATH" to "/system/bin", "HOME" to "/data/app-home", "PHONECANDO_BRIDGE_TOKEN" to "stale")

  @Test fun layersInOrderWithTheTagLast() {
    val env = EngineEnv.build(
      base = base + ("PHONECANDO_AGENT" to "other"),
      image = mapOf("HOME" to "/img/home", "PATH" to "/img/shims:/system/bin", "PHONECANDO_AGENT" to "spoof"),
      kind = mapOf("OPENCODE_SERVER_PASSWORD" to "pw", "PATH" to "/kind"),
      bridgeUrl = "http://127.0.0.1:5000",
      bridgeToken = "tok",
      channel = "lite",
      agentId = "a1",
    )
    assertEquals("/img/home", env["HOME"])
    assertEquals("/kind", env["PATH"])
    assertEquals("pw", env["OPENCODE_SERVER_PASSWORD"])
    assertEquals("http://127.0.0.1:5000", env["PHONECANDO_BRIDGE_URL"])
    assertEquals("tok", env["PHONECANDO_BRIDGE_TOKEN"])
    assertEquals("lite", env["PHONECANDO_CHANNEL"])
    assertEquals("a1", env["PHONECANDO_AGENT"])
  }

  @Test fun onlyATuiEngineGetsItsEventsFile() {
    val stale = base + ("PHONECANDO_EVENTS" to "/elsewhere")
    val tui = EngineEnv.build(stale, emptyMap(), mapOf("PHONECANDO_EVENTS" to "/kind"), null, "tok", "full", "a1", "/img/home/.phonecando/events")
    assertEquals("/img/home/.phonecando/events", tui["PHONECANDO_EVENTS"])
    val server = EngineEnv.build(stale, emptyMap(), emptyMap(), null, "tok", "full", "a1")
    assertFalse(server.containsKey("PHONECANDO_EVENTS"))
  }

  @Test fun aTuiLearnsTheThemeOnlyOnceTheAppToldIt() {
    assertFalse(EngineEnv.terminal(null).containsKey("COLORFGBG"))
    val ansi = List(16) { "#000000" }
    val dark = checkNotNull(TermTheme.of(true, "#e6e6e6", "#0a0a0a", "#00ff00", ansi))
    val light = checkNotNull(TermTheme.of(false, "#1a1a1a", "#ffffff", "#1a7f37", ansi))
    assertEquals("15;0", EngineEnv.terminal(dark)["COLORFGBG"])
    assertEquals("0;15", EngineEnv.terminal(light)["COLORFGBG"])
    assertEquals("xterm-256color", EngineEnv.terminal(light)["TERM"])
  }

  @Test fun anImageKindCarriesWhatItsMachineUnsets() {
    val env = EngineEnv.build(
      base = base + ("${ImageLaunch.CARRY_PREFIX}STALE" to "old"),
      image = mapOf("HOME" to "/img/home"),
      kind = mapOf("ANTHROPIC_AUTH_TOKEN" to "key", "HOME" to "/root"),
      bridgeUrl = "http://127.0.0.1:5000",
      bridgeToken = "tok",
      channel = "full",
      agentId = "a1",
    )
    // The machine's union: another agent's native kind keeps these from guests.
    val unset = listOf("PHONECANDO_BRIDGE_URL", "PHONECANDO_BRIDGE_TOKEN", "OPENCODE_SERVER_PASSWORD", "ANTHROPIC_AUTH_TOKEN")
    val carry = GuestEnvPolicy.carry(env.keys, unset)
    assertEquals(setOf("PHONECANDO_BRIDGE_URL", "PHONECANDO_BRIDGE_TOKEN", "ANTHROPIC_AUTH_TOKEN"), carry)
    val carried = EngineEnv.carry(env, carry)
    for (name in carry) assertFalse(name, carried.containsKey(name))
    assertEquals("http://127.0.0.1:5000", carried["${ImageLaunch.CARRY_PREFIX}PHONECANDO_BRIDGE_URL"])
    assertEquals("tok", carried["${ImageLaunch.CARRY_PREFIX}PHONECANDO_BRIDGE_TOKEN"])
    assertEquals("key", carried["${ImageLaunch.CARRY_PREFIX}ANTHROPIC_AUTH_TOKEN"])
    assertFalse(carried.containsKey("${ImageLaunch.CARRY_PREFIX}OPENCODE_SERVER_PASSWORD"))
    // Only this launch sets carry names; the rest stays as it was.
    assertFalse(carried.containsKey("${ImageLaunch.CARRY_PREFIX}STALE"))
    assertEquals("a1", carried["PHONECANDO_AGENT"])
    assertEquals("/root", carried["HOME"])
    // Nothing to carry: the env as it was, less any stale carry name.
    assertEquals(env - "${ImageLaunch.CARRY_PREFIX}STALE", EngineEnv.carry(env, emptySet()))
  }

  @Test fun noBridgeMeansNoBridgeValues() {
    val env = EngineEnv.build(base, emptyMap(), emptyMap(), null, "tok", "full", "a1")
    assertFalse(env.containsKey("PHONECANDO_BRIDGE_URL"))
    assertFalse(env.containsKey("PHONECANDO_BRIDGE_TOKEN"))
    assertEquals("a1", env["PHONECANDO_AGENT"])
  }
}
