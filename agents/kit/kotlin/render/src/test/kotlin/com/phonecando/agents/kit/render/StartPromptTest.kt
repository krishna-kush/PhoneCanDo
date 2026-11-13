package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.LaunchContext
import com.phonecando.agents.kit.manifest.ManifestDecoder
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// JVM checks for a TUI engine that starts with a first prompt
// (`engine.prompt`): where its args go, with and without the resume args,
// that the prompt stays one argv item whatever it holds, and what of()
// refuses.
class StartPromptTest {
  private fun tui(engine: String, type: String = """"type":"native"""") = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"demo","label":"Demo","version":"1",$type,"channels":["full"],"stability":"preview",
         "engine":{"style":"tui",$engine}}""",
    ),
    null,
  )

  private val ctx = LaunchContext("/lib", File("/h"), File("/t"), "", "pw")

  // Quotes, a line break, shell syntax and text that looks like a placeholder.
  private val task = "Scheduled task from the user (daily 09:00): say \"hi\"\n\$(rm -rf ~); {{home}} `x`"

  @Test fun thePromptGoesInAsOneArgAppendedOrAtItsIndex() {
    val appended = tui(""""launch":{"argv":["demo","--x"]},"prompt":{"args":["{{prompt}}"]}""")
    assertTrue(appended.promptsAtStart)
    assertTrue(appended.runsSchedules)
    assertEquals(listOf("demo", "--x"), appended.launch(ctx).argv)
    assertEquals(listOf("demo", "--x", task), appended.launch(ctx.copy(prompt = task)).argv)
    val flag = tui(""""launch":{"argv":["demo","--x"]},"prompt":{"args":["-i","{{prompt}}"],"at":1}""")
    assertEquals(listOf("demo", "-i", task, "--x"), flag.launch(ctx.copy(prompt = task)).argv)
  }

  @Test fun bothIndexesCountInTheLaunchsOwnArgvAndResumeComesFirst() {
    val both = tui(""""launch":{"argv":["demo","--x"]},"resume":{"args":["--continue"],"at":1},"prompt":{"args":["{{prompt}}"],"at":1}""")
    assertEquals(listOf("demo", "--continue", task, "--x"), both.launch(ctx.copy(resume = true, prompt = task)).argv)
    assertEquals(listOf("demo", task, "--x"), both.launch(ctx.copy(prompt = task)).argv)
    val apart = tui(""""launch":{"argv":["demo","--x"]},"resume":{"args":["resume","--last"],"at":1},"prompt":{"args":["{{prompt}}"]}""")
    assertEquals(listOf("demo", "resume", "--last", "--x", task), apart.launch(ctx.copy(resume = true, prompt = task)).argv)
  }

  @Test fun anImageKindGetsThePromptAsOneOfItsShellsArgs() {
    val image = tui(
      """"launch":{"argv":["sh","-c","exec demo \"${'$'}@\"","demo"]},"resume":{"args":["-r"]},"prompt":{"args":["{{prompt}}"]}""",
      type = """"type":"image","requires":{"linux":"required"}""",
    )
    val argv = image.launch(ctx.copy(image = File("/i"), resume = true, prompt = task)).argv
    assertEquals(listOf("sh", "-c", "exec demo \"\$@\"", "demo", "-r", task), argv.drop(3))
  }

  @Test fun aKindWithoutPromptArgsRefusesAPrompt() {
    val plain = tui(""""launch":{"argv":["demo"]}""")
    assertFalse(plain.promptsAtStart)
    assertFalse(plain.runsSchedules)
    assertEquals("demo cannot start with a prompt (no engine.prompt)", assertFailsWith<KindException> { plain.launch(ctx.copy(prompt = "x")) }.message)
  }

  @Test fun refusesPromptArgsThatAreNotOneWholeItem() {
    val refused = { engine: String -> assertFailsWith<KindException> { tui(engine) }.message }
    val once = "demo: engine.prompt.args holds {{prompt}} as one whole arg, once"
    assertEquals(once, refused(""""launch":{"argv":["demo"]},"prompt":{"args":["--p={{prompt}}"]}"""))
    assertEquals(once, refused(""""launch":{"argv":["demo"]},"prompt":{"args":["{{prompt}}","{{prompt}}"]}"""))
    assertEquals(once, refused(""""launch":{"argv":["demo"]},"prompt":{"args":["-i"]}"""))
    assertEquals(
      "demo: engine.prompt.at must be 1..256",
      refused(""""launch":{"argv":["demo"]},"prompt":{"args":["{{prompt}}"],"at":0}"""),
    )
    assertEquals(
      "demo: engine.prompt.at must be past the shell script's \$0 (4 or more), or absent",
      refused(""""launch":{"argv":["sh","-c","exec demo \"${'$'}@\"","demo"]},"prompt":{"args":["{{prompt}}"],"at":2}"""),
    )
  }
}
