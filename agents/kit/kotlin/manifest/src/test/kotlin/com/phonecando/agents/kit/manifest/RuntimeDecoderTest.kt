package com.phonecando.agents.kit.manifest

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

// JVM checks for RuntimeDecoder on the schema's runtime fixtures: the valid
// one reads whole, and what the phone must never take (an unknown family, a
// script path out of the plugin folder) is refused at its JSON pointer.
class RuntimeDecoderTest {
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")), "runtime")
  private val nodeText = File(fixtures, "valid/node.json").readText()

  private fun problem(from: String, to: String): String =
    assertFailsWith<ManifestException> { RuntimeDecoder.decode(nodeText.replace(from, to).also { check(it != nodeText) }) }.message!!

  @Test fun readsTheNodeFixture() {
    val node = RuntimeDecoder.decode(nodeText)
    assertEquals("node", node.id)
    assertEquals("Node.js", node.label)
    assertEquals(22, node.provides)
    assertEquals(PackageFamilies.ALL.toSet(), node.families.toSet())
    assertEquals(listOf("apk", "*"), node.install.keys.toList())
    assertEquals(listOf("{{home}}/.local/opt/node/bin"), node.paths)
    assertEquals(VersionCheck(listOf("node", "--version"), "^v(\\d+)\\."), node.check)
  }

  @Test fun picksTheScriptForAFamily() {
    val node = RuntimeDecoder.decode(nodeText)
    assertEquals("install/apk.sh", node.scriptFor("apk"))
    assertEquals("install/glibc.sh", node.scriptFor("apt"))
    val narrow = node.copy(families = listOf("apk"))
    assertNull(narrow.scriptFor("apt"), "a family the runtime does not claim has no script")
  }

  @Test fun refusesWhatThePhoneMustNotRead() {
    assertEquals("/schema: must be 1", problem("\"schema\": 1", "\"schema\": 2"))
    assertEquals(
      "/families/0: must be one of apt, apk, dnf, yum, microdnf, pacman, zypper, xbps, not debian",
      problem("\"apt\",", "\"debian\","),
    )
    assertEquals("/install/*: must be a path inside the plugin folder, not ../glibc.sh", problem("install/glibc.sh", "../glibc.sh"))
    assertEquals("/install/*: must be a path inside the plugin folder, not /glibc.sh", problem("install/glibc.sh", "/glibc.sh"))
    assertEquals(
      "/install/nix: must be a family (apt, apk, dnf, yum, microdnf, pacman, zypper, xbps) or *",
      problem("\"apk\": \"install/apk.sh\"", "\"nix\": \"install/apk.sh\""),
    )
    assertEquals("/provides: must be an integer", problem("22", "\"22\""))
    assertEquals("/check/pattern: is required", problem(",\n    \"pattern\": \"^v(\\\\d+)\\\\.\"", ""))
  }
}
