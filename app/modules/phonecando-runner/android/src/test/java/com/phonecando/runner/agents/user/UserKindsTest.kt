package com.phonecando.runner.agents.user

import com.phonecando.agents.builtin.BuiltinHooks
import com.phonecando.agents.kit.manifest.PhoneTools
import com.phonecando.runner.agents.AssetTree
import com.phonecando.runner.agents.KindCatalog
import com.phonecando.runner.agents.TestKinds
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.InputStream
import java.nio.file.Files

// JVM checks for the user's kinds on disk: a save keeps only what the
// catalog will load, writes whole files under the id's name, never
// replaces by accident, and a catalog loaded again sees the change; a
// delete keeps a kind an agent uses; ids never leave the folder.
class UserKindsTest {
  private val root = Files.createTempDirectory("user-kinds").toFile()
  private val dir = File(root, "user")
  private val kinds = UserKinds(dir, setOf("opencode"), TestKinds.runtimes.byId)

  @After fun cleanup() {
    root.deleteRecursively()
  }

  // A kind the form makes: Node 22, an install, a bell rule, phone tools off.
  private fun aider(id: String = "user.aider", label: String = "Aider") = """
    {
      "schema": 1, "id": "$id", "label": "$label", "version": "1", "type": "image",
      "channels": ["full", "lite"], "stability": "preview",
      "requires": { "linux": "required", "runtimes": ["node>=22"] },
      "install": { "packages": { "*": ["git"] }, "steps": ["npm install -g --prefix \"${'$'}HOME/.local\" aider"] },
      "update": { "steps": ["npm install -g --prefix \"${'$'}HOME/.local\" aider"] },
      "versionCheck": { "argv": ["/root/.local/bin/aider", "--version"], "pattern": "(\\d+(?:\\.\\d+)+)" },
      "engine": { "style": "tui", "launch": { "argv": ["/root/.local/bin/aider"], "cwd": "{{projectDir}}" } },
      "events": [{ "pty": { "rules": [{ "on": "bel", "event": "waiting" }] } }],
      "idle": { "from": ["output"], "quietSec": 120 },
      "surfaces": { "home": "tui", "terminal": { "shell": true } },
      "phoneTools": "none"
    }
  """.trimIndent()

  @Test fun aSavedKindLoadsInTheNextCatalog() {
    assertEquals(emptyList<UserKinds.Problem>(), kinds.check(aider()))
    assertEquals(UserKinds.Saved.Done("user.aider"), kinds.save(aider(), replace = false))
    assertEquals(listOf("user.aider.json"), dir.list()!!.toList())
    assertEquals(aider(), kinds.read("user.aider"))
    val kind = catalog().get("user.aider")!!
    assertEquals(PhoneTools.NONE, kind.manifest.phoneTools)
    assertEquals(listOf("node"), kind.runtimes.map { it.plugin.id })
    assertEquals(listOf(UserKinds.Entry("user.aider", "Aider", null)), kinds.list())
  }

  @Test fun aSaveNeverReplacesByAccident() {
    kinds.save(aider(), replace = false)
    val again = kinds.save(aider(label = "Aider 2"), replace = false)
    assertEquals(UserKinds.Saved.Refused(listOf(UserKinds.Problem("/id", "you already have an agent kind user.aider"))), again)
    assertEquals("Aider", catalog().get("user.aider")!!.displayName)
    assertEquals(UserKinds.Saved.Done("user.aider"), kinds.save(aider(label = "Aider 2"), replace = true))
    assertEquals("Aider 2", catalog().get("user.aider")!!.displayName)
    // Only the kind: no temp file left behind.
    assertEquals(listOf("user.aider.json"), dir.list()!!.toList())
  }

  @Test fun aSaveRefusesWhatWouldNotLoad() {
    fun refused(text: String) = (kinds.save(text, replace = true) as UserKinds.Saved.Refused).problems.single()
    assertEquals("", refused("{").path)
    assertEquals(UserKinds.Problem("/id", "a user kind's id starts with user."), refused(aider(id = "aider")))
    assertEquals("/id", refused(aider(id = "user.Aider")).path)
    assertEquals("/id", refused(aider(id = "user.../x")).path)
    assertEquals("/engine/style", refused(aider().replace("\"tui\", \"launch\"", "\"server\", \"launch\"")).path)
    assertEquals("/engine/launch/env/PATH", refused(aider().replace("\"cwd\"", "\"env\": { \"PATH\": \"/x\" }, \"cwd\"")).path)
    // A runtime this build lacks, or a pattern that does not compile: the build cannot run it.
    assertTrue(refused(aider().replace("node>=22", "ruby")).detail.contains("ruby"))
    assertEquals("/surfaces", refused(aider().replace("{ \"home\": \"tui\", \"terminal\": { \"shell\": true } }", "1")).path)
    assertTrue(refused(aider().replace("(\\\\d+(?:\\\\.\\\\d+)+)", "(")).detail.contains("does not compile"))
    val big = aider(label = "x".repeat(UserKindRules.MAX_BYTES))
    assertEquals(UserKinds.Problem("", "larger than 64 KiB"), refused(big))
    assertNull(dir.list()?.firstOrNull())
  }

  @Test fun anAgentKeepsItsKind() {
    kinds.save(aider(), replace = false)
    assertEquals(UserKinds.Deleted.InUse(listOf("Aider 2")), kinds.delete("user.aider", listOf("Aider 2")))
    assertTrue(File(dir, "user.aider.json").isFile)
    assertEquals(UserKinds.Deleted.Done(true), kinds.delete("user.aider", emptyList()))
    assertEquals(UserKinds.Deleted.Done(false), kinds.delete("user.aider", emptyList()))
    assertNull(catalog().get("user.aider"))
  }

  @Test fun idsNeverLeaveTheFolder() {
    File(root, "secret.json").writeText("{}")
    assertNull(kinds.read("../secret"))
    assertNull(kinds.read("user.../../secret"))
    assertEquals(UserKinds.Deleted.Done(false), kinds.delete("../secret", emptyList()))
    assertTrue(File(root, "secret.json").isFile)
  }

  @Test fun theListNamesWhatKeepsAKindOut() {
    dir.mkdirs()
    File(dir, "user.broken.json").writeText("""{"label": "Broken", "schema": 2}""")
    File(dir, "user.moved.json").writeText(aider(id = "user.other"))
    File(dir, "notes.txt").writeText("not a kind")
    kinds.save(aider(), replace = false)
    assertEquals(
      listOf(
        UserKinds.Entry("user.aider", "Aider", null),
        UserKinds.Entry("user.broken", "Broken", UserKinds.Problem("/schema", "must be 1")),
        UserKinds.Entry("user.moved", "Aider", UserKinds.Problem("/id", "its id is user.other, not user.moved")),
      ),
      kinds.list(),
    )
    assertEquals(listOf("user.aider"), catalog().all().map { it.id })
  }

  @Test fun aBundledIdIsNeverTaken() {
    val bundled = UserKinds(dir, setOf("user.aider"), TestKinds.runtimes.byId)
    assertEquals(listOf(UserKinds.Problem("/id", "user.aider is a bundled kind's id")), bundled.check(aider()))
    assertFalse(File(dir, "user.aider.json").exists())
  }

  // The folder as the phone's catalog reads it, with no bundled kinds.
  private fun catalog(): KindCatalog {
    val none = object : AssetTree {
      override fun list(path: String): List<String>? = emptyList()

      override fun open(path: String): InputStream = throw java.io.FileNotFoundException(path)
    }
    return KindCatalog.load(none, dir, BuiltinHooks.all, TestKinds.runtimes) { _, _ -> }
  }
}
