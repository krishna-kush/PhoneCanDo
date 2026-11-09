package com.phonecando.runner.engine

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.ManifestDecoder
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.TestKinds
import com.phonecando.runner.engine.image.ImageDir
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// JVM checks for the one launch without resume args: only a TUI launched
// with them that died before it was ready gets it, and only once.
class ResumeFallbackTest {
  private val image = ImageDir(File("/img"))

  private fun tui(resume: String) = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview",
         "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["demo","--x"]}$resume}}""",
    ),
    null,
  )

  private val resuming = tui(""","resume":{"args":["--continue"],"at":1}""")

  private fun plan(kind: ManifestKind, ranBefore: Boolean) = LaunchPlan(
    record = AgentRecord("a1", kind.id, "A", "img", null, "pw", "tok", 0L, ranBefore = ranBefore),
    kind = kind,
    image = image,
    home = image.home,
    imageEnv = emptyMap(),
    requestedAt = 0L,
  )

  private fun argv(plan: LaunchPlan) =
    plan.kind.launch(LaunchContext("/lib", plan.home, image.tmp, "", "pw", image.root, plan.resume)).argv.drop(3)

  @Test fun aResumedTuiThatDiesBeforeReadyLaunchesOnceWithoutThem() {
    val first = plan(resuming, ranBefore = true)
    assertEquals(listOf("demo", "--continue", "--x"), argv(first))
    assertTrue(ResumeFallback.applies(first, 1))
    val again = ResumeFallback.without(first)
    assertEquals(listOf("demo", "--x"), argv(again))
    assertFalse(ResumeFallback.applies(again, 1))
  }

  @Test fun everyOtherExitCountsAsItWould() {
    // Exit 0 before ready, a launch that did not resume, a kind without resume args, a server.
    assertFalse(ResumeFallback.applies(plan(resuming, ranBefore = true), 0))
    assertFalse(ResumeFallback.applies(plan(resuming, ranBefore = false), 1))
    assertFalse(ResumeFallback.applies(plan(tui(""), ranBefore = true), 1))
    assertFalse(ResumeFallback.applies(plan(TestKinds.catalog.get("opencode")!!, ranBefore = true), 1))
  }
}
