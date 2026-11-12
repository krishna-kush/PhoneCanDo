package com.phonecando.runner.engine.events

import com.phonecando.runner.agents.AssetTree
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermissions

// JVM checks for the kit files in a TUI engine's HOME: the scripts land
// executable and fresh, and each agent's events file starts empty on every
// start of its engine.
class KitFilesTest {
  private val root = Files.createTempDirectory("kit").toFile()
  private val home = File(root, "home")
  private val scripts = mutableMapOf("phonecando-event" to "#!/bin/sh\necho event\n", "phonecando-open" to "#!/bin/sh\necho open\n")

  private val assets = object : AssetTree {
    override fun list(path: String): List<String>? = if (path == KitFiles.ASSETS) scripts.keys.sorted() else emptyList()

    override fun open(path: String): InputStream = scripts.getValue(path.removePrefix("${KitFiles.ASSETS}/")).byteInputStream()
  }

  @After fun cleanup() {
    root.deleteRecursively()
  }

  @Test fun scriptsLandExecutableAndTheEventsFileEmpty() {
    KitFiles.prepare(assets, home, "a1")
    KitFiles.events(home, "a1").appendText("Stop\t\t\n")
    // Another agent on the machine keeps its own events.
    KitFiles.prepare(assets, home, "b2")
    KitFiles.events(home, "b2").appendText("Stop\t\t\n")
    scripts["phonecando-open"] = "#!/bin/sh\necho newer\n"
    KitFiles.prepare(assets, home, "a1")
    val bin = File(home, ".phonecando/bin")
    assertEquals(listOf("phonecando-event", "phonecando-open"), bin.list()!!.sorted())
    assertEquals("#!/bin/sh\necho newer\n", File(bin, "phonecando-open").readText())
    for (name in scripts.keys) {
      assertEquals("rwxr-xr-x", PosixFilePermissions.toString(Files.getPosixFilePermissions(File(bin, name).toPath())))
    }
    assertEquals(0L, KitFiles.events(home, "a1").length())
    assertEquals(7L, KitFiles.events(home, "b2").length())
    assertEquals(File(home, ".phonecando/events-a1"), KitFiles.events(home, "a1"))
  }
}
