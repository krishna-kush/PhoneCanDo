package com.phonecando.runner.agents

import com.phonecando.agents.kit.AgentConfig
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.InputStream
import java.nio.file.Files

// JVM checks for ConfigSeeder: copy, keep-if-present, and pruning only what
// an earlier seed wrote.
class ConfigSeederTest {
  private val root = Files.createTempDirectory("seeder").toFile()
  private val assets = File(root, "assets")
  private val home = File(root, "home")
  private val config = AgentConfig("kind-config", ".config/kind", setOf("kind.json"))
  private val dest get() = File(home, ".config/kind")

  // A folder as the APK assets: files list as empty, like AssetManager.
  private val tree = object : AssetTree {
    override fun list(path: String): List<String>? {
      val f = File(assets, path)
      return if (f.isDirectory) f.list()?.sorted() else emptyList()
    }

    override fun open(path: String): InputStream = File(assets, path).inputStream()
  }

  private fun asset(rel: String, text: String) {
    File(assets, "kind-config/$rel").apply { parentFile.mkdirs() }.writeText(text)
  }

  private fun seed() = ConfigSeeder(tree).seed(config, dest)

  @After fun cleanup() {
    root.deleteRecursively()
  }

  @Test fun copiesEveryFileAndRefreshesThem() {
    asset("AGENTS.md", "v1")
    asset("plugins/a/index.ts", "a1")
    seed()
    assertEquals("v1", File(dest, "AGENTS.md").readText())
    assertEquals("a1", File(dest, "plugins/a/index.ts").readText())
    asset("AGENTS.md", "v2")
    seed()
    assertEquals("v2", File(dest, "AGENTS.md").readText())
  }

  @Test fun keepIfPresentIsSeededOnceAndNeverPruned() {
    asset("kind.json", "{}")
    seed()
    File(dest, "kind.json").writeText("{\"key\":\"user\"}")
    seed()
    assertEquals("{\"key\":\"user\"}", File(dest, "kind.json").readText())
    File(assets, "kind-config/kind.json").delete()
    asset("AGENTS.md", "x")
    seed()
    assertTrue(File(dest, "kind.json").exists())
  }

  @Test fun prunesFilesItNoLongerShipsButNotUserFiles() {
    asset("plugins/old/index.ts", "old")
    asset("AGENTS.md", "x")
    seed()
    File(dest, "plugins/mine.ts").writeText("user")
    File(assets, "kind-config/plugins/old").deleteRecursively()
    asset("plugins/new/index.ts", "new")
    seed()
    assertFalse(File(dest, "plugins/old/index.ts").exists())
    assertFalse(File(dest, "plugins/old").exists())
    assertTrue(File(dest, "plugins/new/index.ts").exists())
    assertEquals("user", File(dest, "plugins/mine.ts").readText())
  }

  @Test fun noAssetsLeavesHomeAlone() {
    seed()
    assertFalse(dest.exists())
  }

  @Test fun aManifestEntryOutsideTheConfigDirIsIgnored() {
    asset("AGENTS.md", "x")
    seed()
    val outside = File(home, "keep.txt").apply { writeText("keep") }
    File(dest, ConfigSeeder.MANIFEST).appendText("../../keep.txt\n")
    seed()
    assertTrue(outside.exists())
  }
}
