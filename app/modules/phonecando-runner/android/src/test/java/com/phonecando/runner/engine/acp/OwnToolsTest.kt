package com.phonecando.runner.engine.acp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Which ACP permission questions are about our own tools, and the option
// that allows one: only our exact tool names, bare or with our server's
// name round them.
class OwnToolsTest {
  private val names = setOf("mobile_click", "agents_list", "schedule_add")

  @Test fun ourToolsAsAgentsTitleThem() {
    for (t in listOf(
      "mobile_click",
      "mcp__phonecando__agents_list",
      "phonecando/schedule_add",
      "phonecando.mobile_click",
      "phonecando:mobile_click",
      "mobile_click (phonecando MCP Server)",
      "agents_list (phonecando)",
      "phonecando__mobile_click",
      "phonecando__agents_list: to=\"Ada\"\nand more",
      "  mobile_click  ",
    )) assertTrue(t, OwnTools.isOurs(t, names))
  }

  @Test fun anythingElseStillAsks() {
    for (t in listOf(
      "grep mobile_click notes.txt",
      "Run mobile_click",
      "mcp__other__mobile_click",
      "other/mobile_click",
      "mobile_click (other MCP Server)",
      "mcp__phonecando__rm_rf",
      "mobile_clicks",
      "phonecando__rm_rf: x",
      "phonecando__mobile_click; rm -rf",
      "other__mobile_click",
      "",
    )) assertFalse(t, OwnTools.isOurs(t, names))
    assertFalse(OwnTools.isOurs("mobile_click", emptySet()))
  }

  @Test fun allowsOnceRatherThanAlways() {
    val once = AcpOption("o", "Allow", "allow_once")
    val always = AcpOption("a", "Always", "allow_always")
    val reject = AcpOption("r", "Reject", "reject_once")
    assertEquals(once, OwnTools.allow(listOf(reject, always, once)))
    assertEquals(always, OwnTools.allow(listOf(reject, always)))
    assertNull(OwnTools.allow(listOf(reject)))
  }
}
