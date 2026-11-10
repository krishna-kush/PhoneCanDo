package com.phonecando.linux.terminal

import com.phonecando.lre.api.ImageLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// JVM checks for the terminal tab's shell recipes.
class TerminalRecipeTest {
  private val layout = ImageLayout(File("/data/user/0/pkg/files/images/a1b2c3"))

  @Test fun linuxRunsALoginShellInTheWorkFolderThroughTheShShim() {
    val r = TerminalRecipe.linux(layout)
    assertEquals(
      listOf("/data/user/0/pkg/files/images/a1b2c3/shims/sh", "-c", "cd '/root/projects'; exec \"\$SHELL\" -l"),
      r.cmd,
    )
    assertEquals(
      mapOf(
        "PHONECANDO_IMAGE" to "/data/user/0/pkg/files/images/a1b2c3",
        "HOME" to "/root",
        "TMPDIR" to "/tmp",
        "TERM" to "xterm-256color",
        "COLORTERM" to "truecolor",
        "LANG" to "C.UTF-8",
      ),
      r.env,
    )
  }

  @Test fun linuxStartsOutsideEverySamePathSoTheGuestLandsInRoot() {
    val cwd = TerminalRecipe.linux(layout).cwd
    assertEquals(layout.run.path, cwd)
    listOf(layout.home.path, layout.tmp.path).forEach { same -> assertFalse(cwd == same || cwd.startsWith("$same/")) }
  }

  @Test fun noRecipeCarriesTheEngineTag() {
    assertFalse("PHONECANDO_AGENT" in TerminalRecipe.linux(layout).env)
    assertFalse("PHONECANDO_AGENT" in TerminalRecipe.android(layout).env)
  }

  @Test fun androidRunsTheSystemShellInTheWorkFolder() {
    val r = TerminalRecipe.android(layout)
    assertEquals(listOf("/system/bin/sh", "-l"), r.cmd)
    assertEquals(layout.home.path, r.env["HOME"])
    assertEquals(layout.tmp.path, r.env["TMPDIR"])
    assertEquals("${layout.home.path}/projects", r.cwd)
    assertFalse("PHONECANDO_IMAGE" in r.env)
  }

  @Test fun onlyTheLauncherIsHandedTheTerminal() {
    assertTrue(TerminalRecipe.linux(layout).handOver)
    assertFalse(TerminalRecipe.android(layout).handOver)
  }

  @Test fun theMapHasThePtyRecipeShape() {
    val map = TerminalRecipe.linux(layout).toMap()
    assertEquals(setOf("cmd", "env", "cwd", "handOver"), map.keys)
    assertTrue(map["cmd"] is List<*>)
    assertEquals(true, map["handOver"])
  }
}
