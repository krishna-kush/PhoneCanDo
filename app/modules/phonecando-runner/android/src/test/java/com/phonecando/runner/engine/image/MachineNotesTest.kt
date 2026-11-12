package com.phonecando.runner.engine.image

import com.phonecando.runner.agents.AgentStore
import com.phonecando.runner.engine.image.MachineNote.Mate
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for keeping the machine-mates note current: every agent on a
// machine is named in the others' notes (an agent that keeps its own state
// in the file in its state folder), a kind without an instructions file
// gets none, a rename or delete is seen on the next refresh, and one file
// that cannot be written never stops the others.
class MachineNotesTest {
  private val root = Files.createTempDirectory("machinenotes").toFile()
  private val home = File(root, "images/m1/home")
  private val store = AgentStore(File(root, "state/agents.json"))
  private val kinds = mapOf("alpha" to FakeKind("alpha", "Alpha", "AGENTS.md"), "nada" to FakeKind("nada", "Nada", null))
  private val notes = MachineNotes(store, kinds::get)
  private val failed = mutableListOf<String>()

  @After fun cleanup() {
    root.deleteRecursively()
  }

  private fun refresh(imageId: String = "m1", at: File = home) = notes.refresh(imageId, at) { a, _ -> failed += a.name }

  private fun shared(body: String?) = MachineNote.merge(null, body)

  @Test fun everyAgentIsNamedInTheOthersNotes() {
    val ann = store.create("alpha", "Ann", "m1", ownStateSupported = true)
    val bob = store.create("alpha", "Bob", "m1", ownStateSupported = true)
    store.create("nada", "Cy", "m1")
    store.create("alpha", "Dee", "m2")
    File(home, ".alpha/AGENTS.md").apply { parentFile.mkdirs() }.writeText("# Mine\n")
    refresh()
    assertEquals(emptyList<String>(), failed)
    val annNote = MachineNote.body(Mate("Ann", "Alpha"), listOf(Mate("Bob", "Alpha"), Mate("Cy", "Nada")))
    assertEquals("# Mine\n\n" + shared(annNote), File(home, ".alpha/AGENTS.md").readText())
    // Bob joined Ann's kind there: his file is in his own state folder.
    assertTrue(bob.ownState)
    val bobNote = MachineNote.body(Mate("Bob", "Alpha"), listOf(Mate("Ann", "Alpha"), Mate("Cy", "Nada")))
    assertEquals(shared(bobNote), File(AgentFiles.stateDir(home, bob.id), "AGENTS.md").readText())
    // Cy's kind has no instructions file; Dee is on another machine.
    assertFalse(File(root, "images/m2").exists())
    assertFalse(ann.ownState)
  }

  @Test fun aRenameOrDeleteIsSeenAndAnAgentAloneLosesTheNote() {
    val ann = store.create("alpha", "Ann", "m1", ownStateSupported = true)
    val bob = store.create("alpha", "Bob", "m1", ownStateSupported = true)
    File(home, ".alpha/AGENTS.md").apply { parentFile.mkdirs() }.writeText("# Mine\n")
    refresh()
    store.rename(bob.id, "Rob")
    refresh()
    val renamed = MachineNote.body(Mate("Ann", "Alpha"), listOf(Mate("Rob", "Alpha")))
    assertEquals("# Mine\n\n" + shared(renamed), File(home, ".alpha/AGENTS.md").readText())
    store.delete(bob.id)
    refresh()
    assertEquals("# Mine\n", File(home, ".alpha/AGENTS.md").readText())
    // Alone from the start: no file is made for it.
    val dee = store.create("alpha", "Dee", "m2")
    val m2 = File(root, "images/m2/home")
    refresh("m2", m2)
    assertFalse(File(m2, ".alpha/AGENTS.md").exists())
    assertEquals(listOf(ann.id), store.onMachine("m1").map { it.id })
    assertEquals(listOf(dee.id), store.onMachine("m2").map { it.id })
  }

  @Test fun oneFileThatCannotBeWrittenNeverStopsTheOthers() {
    store.create("alpha", "Ann", "m1", ownStateSupported = true)
    val bob = store.create("alpha", "Bob", "m1", ownStateSupported = true)
    // Ann's instructions path is a folder.
    File(home, ".alpha/AGENTS.md").mkdirs()
    refresh()
    assertEquals(listOf("Ann"), failed)
    assertTrue(File(AgentFiles.stateDir(home, bob.id), "AGENTS.md").readText().contains("\"Ann\" (Alpha)"))
  }
}
