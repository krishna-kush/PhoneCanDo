package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.manifest.Origin
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

// What ManifestKind.of() refuses in phoneToolsTrust (PhoneToolsChecks): a
// bundled MCP kind without it, one with it but no MCP phone tools, a trust
// in argv the launch does not hold, a trust in a file with no config folder
// or on a user kind; and what it takes.
class PhoneToolsChecksTest {
  private fun bundled(fields: String) = ManifestDecoder.decode(
    """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
       "engine":{"style":"tui","launch":{"argv":["{{libDir}}/demo",{"when":"bridgeUrl","args":["--trust","phonecando"]}]}}$fields}""",
  )

  private fun user(fields: String) = ManifestDecoder.decode(
    """{"schema":1,"id":"user.top","label":"top","version":"1","type":"image","channels":["full"],"stability":"preview",
       "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["top","--trust=phonecando"]}},
       "surfaces":{"home":"tui"}$fields}""",
    Origin.USER,
  )

  private fun refused(manifest: () -> Manifest): String =
    assertFailsWith<KindException> { ManifestKind.of(manifest(), null) }.message!!

  private val argvTrust = ""","phoneToolsTrust":{"in":"argv","has":"phonecando"}"""

  @Test fun aBundledMcpKindNamesItsTrust() {
    for (tools in listOf("mcp:argv", "mcp:config")) {
      assertEquals("demo: a kind with MCP phone tools needs phoneToolsTrust", refused { bundled(""","phoneTools":"$tools"""") })
      // Its launch holds the text in a conditional arg.
      ManifestKind.of(bundled(""","phoneTools":"$tools"$argvTrust"""), null)
    }
    // Plugin tools, or none, need no trust.
    ManifestKind.of(bundled(""","phoneTools":"plugin""""), null)
    ManifestKind.of(bundled(""), null)
  }

  @Test fun trustGoesWithMcpToolsOnly() {
    for (tools in listOf(""","phoneTools":"plugin"""", ""","phoneTools":"none"""", "")) {
      assertEquals("demo: phoneToolsTrust goes with phoneTools mcp:argv or mcp:config", refused { bundled("$tools$argvTrust") })
    }
  }

  @Test fun inArgvTheLaunchHoldsIt() {
    assertEquals(
      "demo: engine.launch.argv holds no trust-me",
      refused { bundled(""","phoneTools":"mcp:argv","phoneToolsTrust":{"in":"argv","has":"trust-me"}""") },
    )
    assertEquals(
      "demo: phoneToolsTrust.has is 1..${PhoneToolsChecks.MAX_HAS} characters",
      refused { bundled(""","phoneTools":"mcp:argv","phoneToolsTrust":{"in":"argv","has":""}""") },
    )
  }

  @Test fun inAFileTheKindHasAConfigFolder() {
    val file = ""","phoneTools":"mcp:config","phoneToolsTrust":{"in":"settings.json","has":"phonecando"}"""
    ManifestKind.of(bundled("""$file,"config":{"dir":"config","into":".demo"}"""), null)
    assertEquals("demo: phoneToolsTrust.in settings.json needs config.dir", refused { bundled("""$file,"config":{"into":".demo"}""") })
    assertEquals("demo: phoneToolsTrust.in settings.json needs config.dir", refused { bundled(file) })
  }

  @Test fun aUserKindMayLeaveItOutAndTrustsOnlyInArgv() {
    ManifestKind.of(user(""","phoneTools":"mcp:argv""""), null)
    ManifestKind.of(user(""","phoneTools":"mcp:argv"$argvTrust"""), null)
    assertEquals(
      "user.top: a user kind has no config folder, so its phoneToolsTrust is in argv",
      refused { user(""","phoneTools":"mcp:argv","phoneToolsTrust":{"in":"settings.json","has":"phonecando"}""") },
    )
  }
}
