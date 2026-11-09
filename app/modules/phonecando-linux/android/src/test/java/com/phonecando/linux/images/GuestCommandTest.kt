package com.phonecando.linux.images

import com.phonecando.lre.api.ImageLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

// JVM checks for how a reset's package query reaches the guest.
class GuestCommandTest {
  private val layout = ImageLayout(File("/files/images/a1b2c3"))
  private val engineEnv = "HOME=/files/images/a1b2c3/home\nTMPDIR=/files/images/a1b2c3/tmp\nPATH=/files/images/a1b2c3/shims:/system/bin\r\n" +
    "PHONECANDO_AGENT=never\nnot a line\n=nokey\n"

  @Test fun theShimRunsWithEngineEnvOverTheAppsEnvironment() {
    val c = GuestCommand.build(layout, listOf("dpkg-query", "-W"), engineEnv, mapOf("PATH" to "/system/bin", "ANDROID_DATA" to "/data"))
    assertEquals(listOf("/files/images/a1b2c3/shims/dpkg-query", "-W"), c.argv)
    assertEquals("/files/images/a1b2c3/shims:/system/bin", c.env["PATH"])
    assertEquals("/data", c.env["ANDROID_DATA"])
    assertEquals("/files/images/a1b2c3", c.env["PHONECANDO_IMAGE"])
    assertEquals("/files/images/a1b2c3/home", c.env["HOME"])
  }

  @Test fun theEngineTagNeverReachesTheGuest() {
    val c = GuestCommand.build(layout, listOf("rpm", "-qa"), engineEnv, mapOf("PHONECANDO_AGENT" to "a1"))
    assertFalse("PHONECANDO_AGENT" in c.env)
    val overridden = GuestCommand.build(layout, listOf("sh"), "", emptyMap(), mapOf("PHONECANDO_AGENT" to "a1"))
    assertFalse("PHONECANDO_AGENT" in overridden.env)
  }

  @Test fun overridesWinOverEngineEnvButNotTheImageTag() {
    val overrides = GuestCommand.GUEST_DIRS + mapOf("PHONECANDO_RUN" to "r1", "PHONECANDO_IMAGE" to "/elsewhere")
    val c = GuestCommand.build(layout, listOf("sh", "-s"), engineEnv, emptyMap(), overrides)
    assertEquals(listOf("/files/images/a1b2c3/shims/sh", "-s"), c.argv)
    assertEquals("/root", c.env["HOME"])
    assertEquals("/tmp", c.env["TMPDIR"])
    assertEquals("r1", c.env["PHONECANDO_RUN"])
    assertEquals("/files/images/a1b2c3/shims:/system/bin", c.env["PATH"])
    assertEquals("/files/images/a1b2c3", c.env["PHONECANDO_IMAGE"])
  }

  @Test fun argv0IsACommandNameNotAPath() {
    listOf("/bin/sh", "../sh", ".hidden", "").forEach { name ->
      try {
        GuestCommand.build(layout, listOf(name), "", emptyMap())
        fail("$name must be refused")
      } catch (_: IllegalArgumentException) {
      }
    }
  }
}
