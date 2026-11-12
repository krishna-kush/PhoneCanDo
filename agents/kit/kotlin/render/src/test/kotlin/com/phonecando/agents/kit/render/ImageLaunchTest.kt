package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.ManifestDecoder
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

// The image's sh script: what it carries past the launcher, in what order,
// and that the host's sh reads it back as meant.
class ImageLaunchTest {
  private val exec = "exec \"\$0\" \"\$@\""

  @Test fun noCarryLeavesTheScriptAsItWas() {
    assertEquals(exec, ImageLaunch.script(emptyList()))
    assertEquals("cd '/root' || exit; PATH='/a:/b':\$PATH; export PATH; $exec", ImageLaunch.script(listOf("/a", "/b"), "/root"))
    assertEquals(ImageLaunch.script(listOf("/a"), "/root"), ImageLaunch.script(listOf("/a"), "/root", emptySet()))
  }

  @Test fun carriedNamesComeBackAfterTheCdAndBeforePathAndExec() {
    assertEquals(
      "cd '/root' || exit; " +
        "A=\"\$PHONECANDO_CARRY_A\"; export A; unset PHONECANDO_CARRY_A; " +
        "B_2=\"\$PHONECANDO_CARRY_B_2\"; export B_2; unset PHONECANDO_CARRY_B_2; " +
        "PATH='/a':\$PATH; export PATH; $exec",
      ImageLaunch.script(listOf("/a"), "/root", linkedSetOf("B_2", "A", "A")),
    )
  }

  @Test fun refusesWhatIsNoEnvName() {
    for (name in listOf("", "1A", "A-B", "A;rm", "A B", "\$A", "A=\"x\"")) {
      assertFailsWith<KindException>(name) { ImageLaunch.script(emptyList(), carry = setOf(name)) }
    }
  }

  @Test fun theShellRestoresEachValueAsItWas() {
    val value = "it's \"quoted\" \$HOME `x` \\ and\nlines"
    val script = ImageLaunch.script(emptyList(), carry = setOf("PHONECANDO_BRIDGE_TOKEN", "EMPTY"))
      .replace(ImageLaunch.EXEC, "printf '%s|%s|%s' \"\$PHONECANDO_BRIDGE_TOKEN\" \"\${EMPTY-unset}\" \"\${PHONECANDO_CARRY_PHONECANDO_BRIDGE_TOKEN-gone}\"")
    val env = ImageLaunch.carried(linkedMapOf("PHONECANDO_BRIDGE_TOKEN" to value, "EMPTY" to "", "OTHER" to "o"), setOf("PHONECANDO_BRIDGE_TOKEN", "EMPTY"))
    assertEquals(listOf("PHONECANDO_CARRY_PHONECANDO_BRIDGE_TOKEN", "PHONECANDO_CARRY_EMPTY", "OTHER"), env.keys.toList())
    val process = ProcessBuilder("sh", "-c", script).redirectErrorStream(true).apply {
      environment().clear()
      environment().putAll(env + ("PATH" to System.getenv("PATH")))
    }.start()
    val output = process.inputStream.bufferedReader().readText()
    assertEquals(0, process.waitFor(), output)
    assertEquals("$value||gone", output)
  }

  @Test fun anImageKindCarriesWhatTheHostNames() {
    val image = ManifestKind.of(
      ManifestDecoder.decode(
        """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview",
           "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["demo"]}}}""",
      ),
      null,
    )
    val ctx = LaunchContext("/lib", File("/i/home"), File("/i/tmp"), "", "pw", image = File("/i"), carry = setOf("PHONECANDO_BRIDGE_URL"))
    assertEquals(
      listOf(
        "/i/shims/sh",
        "-c",
        "cd '/root' || exit; PHONECANDO_BRIDGE_URL=\"\$PHONECANDO_CARRY_PHONECANDO_BRIDGE_URL\"; export PHONECANDO_BRIDGE_URL; " +
          "unset PHONECANDO_CARRY_PHONECANDO_BRIDGE_URL; $exec",
        "demo",
      ),
      image.launch(ctx).argv,
    )
    // A native kind's engine runs outside the image: nothing to carry.
    val native = ManifestKind.of(
      ManifestDecoder.decode(
        """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"native","channels":["full"],"stability":"preview",
           "engine":{"style":"tui","launch":{"argv":["{{libDir}}/demo"]}}}""",
      ),
      null,
    )
    assertEquals(listOf("/lib/demo"), native.launch(ctx).argv)
  }
}
