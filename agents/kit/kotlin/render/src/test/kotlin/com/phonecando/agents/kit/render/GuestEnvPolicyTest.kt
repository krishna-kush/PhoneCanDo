package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.Origin
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertNull

// GuestEnvPolicy on the real opencode manifest (the schema's opencode
// fixture is it) and on image kinds, and VersionParse.
class GuestEnvPolicyTest {
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))

  @Test fun aNativeKindsImageLosesTheBridgeAndItsSecrets() {
    val opencode = ManifestDecoder.decode(File(fixtures, "valid/opencode.json").readText())
    // The bridge, the engine password and a local model's key (besides LD_*).
    assertEquals(
      listOf("PHONECANDO_BRIDGE_URL", "PHONECANDO_BRIDGE_TOKEN", "OPENCODE_SERVER_PASSWORD", "LOCAL_MODEL_KEY"),
      GuestEnvPolicy.unset(opencode),
    )
  }

  @Test fun anImageKindKeepsEverything() {
    for (file in listOf("claude-code.json", "gemini-cli.json", "user-top.json")) {
      val m = ManifestDecoder.decode(File(fixtures, "valid/$file").readText(), if (file.startsWith("user-")) Origin.USER else Origin.BUNDLED)
      assertEquals(emptyList(), GuestEnvPolicy.unset(m), file)
    }
  }

  @Test fun secretsAreWhatHoldsAPasswordOrASecret() {
    val m = ManifestDecoder.decode(
      """{"schema":1,"id":"n","label":"N","version":"1","type":"native","channels":["full"],"stability":"stable",
         "engine":{"style":"tui","launch":{"argv":["x"],"env":{"A":"{{password}}","B":"k={{secret:api}}","C":"{{home}}"}}}}""",
    )
    assertEquals(listOf("PHONECANDO_BRIDGE_URL", "PHONECANDO_BRIDGE_TOKEN", "A", "B"), GuestEnvPolicy.unset(m))
  }

  @Test fun parsesTheVersion() {
    assertEquals("2.1.3", VersionParse.parse("Claude Code 2.1.3 (x)\n", "(\\d+\\.\\d+\\.\\d+)"))
    assertEquals("v22", VersionParse.parse("  v22  ", "^(.+)$"))
    assertNull(VersionParse.parse("no version", "(\\d+)"))
    assertNull(VersionParse.parse("1.2", "\\d+"), "no group 1")
    assertNull(VersionParse.parse("x", "(y)?x"), "an empty group 1")
  }
}
