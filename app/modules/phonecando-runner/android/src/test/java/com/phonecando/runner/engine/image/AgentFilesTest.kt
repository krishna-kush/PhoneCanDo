package com.phonecando.runner.engine.image

import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.TestKinds
import com.phonecando.runner.engine.events.KitFiles
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermissions

// JVM checks for what one agent keeps on a shared machine: its own engine
// log, events file and state folder by name, the folders its kind needs in
// that state folder, and a delete that takes only those (and, when it kept
// its state where its kind does and the machine stays, the kind's user
// state), never following a link into what the agents share.
class AgentFilesTest {
  private val root = Files.createTempDirectory("agentfiles").toFile()
  private val image = ImageDir(File(root, "images/m1"))
  private val home = image.home

  @After fun cleanup() {
    root.walkBottomUp().forEach { it.setWritable(true) }
    root.deleteRecursively()
  }

  private val kind = FakeKind("alpha", "Alpha", null, userState = listOf(".alpha/auth.json", ".alpha/sessions"))

  private fun agent(id: String, ownState: Boolean) = AgentRecord(id, "alpha", id, "m1", null, "pw", "tok-$id", 0L, ownState = ownState)

  @Test fun eachAgentHasItsOwnFiles() {
    assertEquals(File(image.root, "logs/engine-a1.log"), image.engineLog("a1"))
    assertEquals(File(home, ".phonecando/events-a1"), KitFiles.events(home, "a1"))
    assertEquals(File(home, ".phonecando/agents/a1"), AgentFiles.stateDir(home, "a1"))
    assertNull(AgentFiles.ownState(home, agent("a1", ownState = false)))
    assertEquals(File(home, ".phonecando/agents/a1"), AgentFiles.ownState(home, agent("a1", ownState = true)))
    assertEquals(
      listOf(image.engineLog("a1"), KitFiles.events(home, "a1"), File(home, ".phonecando/inbox-a1")),
      AgentFiles.of(image, agent("a1", ownState = false)),
    )
  }

  @Test fun removeTakesOnlyTheAgentsOwnFiles() {
    val a = agent("a1", ownState = true)
    val b = agent("b2", ownState = true)
    for (agent in listOf(a, b)) {
      image.engineLog(agent.id).apply { parentFile.mkdirs() }.writeText("log")
      KitFiles.events(home, agent.id).apply { parentFile.mkdirs() }.writeText("Stop\t\t\n")
      File(home, ".phonecando/inbox-${agent.id}/pending/ids").apply { parentFile.mkdirs() }.writeText("1\n")
      File(AgentFiles.stateDir(home, agent.id), "settings.json").apply { parentFile.mkdirs() }.writeText("{}")
    }
    // What the agents share, and a link to it in a's state folder.
    File(home, "projects/app/main.c").apply { parentFile.mkdirs() }.writeText("int main;")
    Files.createSymbolicLink(File(AgentFiles.stateDir(home, a.id), "projects").toPath(), File(home, "projects").toPath())
    // A folder a guest left read-only.
    val locked = File(AgentFiles.stateDir(home, a.id), "cache/mod").apply { mkdirs() }
    File(locked, "x").writeText("x")
    Files.setPosixFilePermissions(locked.toPath(), PosixFilePermissions.fromString("r-xr-xr-x"))

    assertEquals(emptyList<File>(), AgentFiles.remove(image, a, kind, machineStays = true))

    for (file in AgentFiles.of(image, a)) assertFalse(file.path, file.exists())
    for (file in AgentFiles.of(image, b)) assertTrue(file.path, file.exists())
    assertEquals("int main;", File(home, "projects/app/main.c").readText())
    assertTrue(File(home, ".phonecando").isDirectory)
    // Nothing there: a no-op.
    assertEquals(emptyList<File>(), AgentFiles.remove(image, a, kind, machineStays = true))
  }

  @Test fun anAgentThatUsedTheKindsStateLeavesItOnlyWhenItWasTheLast() {
    val a = agent("a1", ownState = false)
    val paths = listOf(File(home, ".alpha/auth.json"), File(home, ".alpha/sessions"))
    assertEquals(paths, AgentFiles.userState(image, a, kind, machineStays = true))
    // Its machine goes with it, its state was its own, or its kind is gone: nothing more.
    assertEquals(emptyList<File>(), AgentFiles.userState(image, a, kind, machineStays = false))
    assertEquals(emptyList<File>(), AgentFiles.userState(image, agent("a1", ownState = true), kind, machineStays = true))
    assertEquals(emptyList<File>(), AgentFiles.userState(image, a, null, machineStays = true))
  }

  @Test fun theKindsStateGoesSoTheNextAgentStartsClean() {
    val a = agent("a1", ownState = false)
    File(home, ".alpha/auth.json").apply { parentFile.mkdirs() }.writeText("{\"token\":1}")
    File(home, ".alpha/config.toml").writeText("model = 1")
    File(home, ".alpha/sessions/s1.jsonl").apply { parentFile.mkdirs() }.writeText("{}")
    File(home, "projects/app/main.c").apply { parentFile.mkdirs() }.writeText("int main;")
    Files.createSymbolicLink(File(home, ".alpha/sessions/projects").toPath(), File(home, "projects").toPath())

    assertEquals(emptyList<File>(), AgentFiles.remove(image, a, kind, machineStays = true))

    assertFalse(File(home, ".alpha/auth.json").exists())
    assertFalse(File(home, ".alpha/sessions").exists())
    // What the kind does not name, and what a link in it led to, stay.
    assertEquals("model = 1", File(home, ".alpha/config.toml").readText())
    assertEquals("int main;", File(home, "projects/app/main.c").readText())
  }

  @Test fun aPathThroughALinkOrOutOfTheImageIsNeverDeleted() {
    val a = agent("a1", ownState = false)
    val elsewhere = File(root, "elsewhere").apply { mkdirs() }
    File(elsewhere, "auth.json").writeText("keep")
    home.mkdirs()
    Files.createSymbolicLink(File(home, ".linked").toPath(), elsewhere.toPath())
    File(root, "outside.json").writeText("keep")
    val sneaky = FakeKind("alpha", "Alpha", null, userState = listOf(".linked/auth.json", "../../../outside.json"))

    val left = AgentFiles.remove(image, a, sneaky, machineStays = true)

    assertEquals(listOf(File(home, ".linked/auth.json"), File(home, "../../../outside.json")), left)
    assertEquals("keep", File(elsewhere, "auth.json").readText())
    assertEquals("keep", File(root, "outside.json").readText())
  }

  @Test fun anAgentsStateFolderHasTheKindsFoldersBeforeItStarts() {
    val state = AgentFiles.stateDir(home, "a1")
    AgentFiles.makeState(FakeKind("alpha", "Alpha", "inst/AGENTS.md", configFolder = "conf"), home, state)
    assertTrue(File(state, "inst").isDirectory)
    assertTrue(File(state, "conf").isDirectory)
    // Codex reads CODEX_HOME (<state>/codex), where its instructions are.
    val codex = checkNotNull(TestKinds.catalog.get("codex"))
    val other = AgentFiles.stateDir(home, "b2")
    AgentFiles.makeState(codex, home, other)
    assertEquals(File(other, "codex/AGENTS.md"), codex.instructionsFile(home, other))
    assertTrue(File(other, "codex").isDirectory)
  }
}
