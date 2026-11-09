package com.phonecando.agents.kit.manifest

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

// JVM checks for the install blocks and hook events of an agent.json: read
// with their types, family names known, errors that name the JSON pointer.
class InstallDecoderTest {
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))

  private fun with(field: String) =
    """{"schema":1,"id":"d","label":"D","version":"1","type":"image","channels":["full"],"stability":"stable",$field}"""

  private fun problem(field: String): String = assertFailsWith<ManifestException> { ManifestDecoder.decode(with(field)) }.message!!

  @Test fun readsTheGeminiFixture() {
    val m = ManifestDecoder.decode(File(fixtures, "valid/gemini-cli.json").readText())
    assertEquals(listOf(RuntimeNeed("node", 22)), m.runtimes)
    val install = m.install!!
    assertEquals(listOf("apt", "apk", "dnf", "pacman", "zypper"), install.families)
    assertEquals(listOf("apt", "apk", "*"), install.packages.keys.toList())
    assertEquals(listOf("git", "ripgrep"), install.packagesFor("apk"))
    assertEquals(listOf("git"), install.packagesFor("dnf"))
    assertEquals(1200, install.timeoutSec)
    assertEquals(3, install.retries)
    assertEquals(listOf("npm install -g --prefix \"\$HOME/.local\" @google/gemini-cli@latest"), install.steps)
    assertEquals(install.steps, m.update!!.steps)
    assertEquals(VersionCheck(listOf("{{home}}/.local/bin/gemini", "--version"), "(\\d+\\.\\d+\\.\\d+)"), m.versionCheck)
    assertEquals(
      EventSource.Hook(mapOf("AfterAgent" to PtyEvent.FINISHED, "Notification" to PtyEvent.WAITING, "BeforeAgent" to PtyEvent.WORKING)),
      m.events.single(),
    )
  }

  @Test fun anInstallMayNameLittle() {
    val m = ManifestDecoder.decode(with(""""install":{},"versionCheck":{"argv":["x"],"pattern":"(1)"}"""))
    assertEquals(Install(null, emptyMap(), emptyList(), null, null), m.install)
    assertEquals(emptyList(), m.install!!.packagesFor("apt"))
    assertEquals(emptyList(), m.runtimes)
    assertNull(m.update)
    assertEquals(0, ManifestDecoder.decode(with(""""install":{"retries":0}""")).install!!.retries)
  }

  @Test fun parsesRuntimeNeeds() {
    assertEquals(RuntimeNeed("node", null), RuntimeNeed.parse("node"))
    assertEquals(RuntimeNeed("py-thon", 3), RuntimeNeed.parse("py-thon>=3"))
    for (bad in listOf("node>=0", "node>22", "Node", "node>=", "node>=12345")) assertNull(RuntimeNeed.parse(bad), bad)
  }

  @Test fun errorsNameTheJsonPointer() {
    assertEquals("/requires/runtimes/1: must be <id> or <id>>=<major>, not node>22", problem(""""requires":{"runtimes":["py","node>22"]}"""))
    assertEquals("/requires/runtimes: names runtime node twice", problem(""""requires":{"runtimes":["node","node>=22"]}"""))
    assertEquals("/install: must be an object, not a string", problem(""""install":"install.sh""""))
    assertEquals(
      "/install/families/0: must be one of apt, apk, dnf, yum, microdnf, pacman, zypper, xbps, not debian",
      problem(""""install":{"families":["debian"]}"""),
    )
    assertEquals(
      "/install/packages/nix: must be a family (apt, apk, dnf, yum, microdnf, pacman, zypper, xbps) or *",
      problem(""""install":{"packages":{"nix":["x"]}}"""),
    )
    assertEquals("/install/packages/apt/0: must be a string, not 1", problem(""""install":{"packages":{"apt":[1]}}"""))
    assertEquals("/install/timeoutSec: must be an integer", problem(""""install":{"timeoutSec":"60"}"""))
    assertEquals("/install/retries: must be an integer", problem(""""install":{"retries":1.5}"""))
    assertEquals("/install/retries: must be 0 to 5, not 6", problem(""""install":{"retries":6}"""))
    assertEquals("/install/retries: must be 0 to 5, not -1", problem(""""install":{"retries":-1}"""))
    assertEquals("/update/steps: is required", problem(""""update":{}"""))
    assertEquals("/versionCheck/pattern: is required", problem(""""versionCheck":{"argv":["x"]}"""))
    assertEquals(
      "/events/0/hook/map/Stop: must be one of working, waiting, finished, failed, not done",
      problem(""""events":[{"hook":{"map":{"Stop":"done"}}}]"""),
    )
    assertEquals("/events/0/hook/map: is required", problem(""""events":[{"hook":{}}]"""))
  }
}
