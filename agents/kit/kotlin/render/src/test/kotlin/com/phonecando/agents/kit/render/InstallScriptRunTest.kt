package com.phonecando.agents.kit.render

import kotlinx.serialization.json.JsonPrimitive
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// A rendered install run for real on the host's sh, grep and sed, with a
// made-up runtime "fake" whose check is `fake --version` (`v<major>.x`) and
// whose install script puts a fake of major 22 in $HOME/rt/bin, its path.
// The runtime phase skips the install when the check passes, runs it when
// the runtime is missing or too old, and fails when it still is after. A
// failed step or runtime script runs again (`@retry` lines), with `sleep` a
// shell function that notes how long it would wait (a function, since
// busybox sh runs its own sleep without a PATH lookup).
class InstallScriptRunTest {
  @TempDir lateinit var home: File

  private fun fake(major: Int) = "#!/bin/sh\necho v$major.1.0\n"

  // The install script writes the fake runtime it is given and notes that it ran.
  private fun plugin(installs: Int) = Runtimes.plugin(
    """"id":"fake","provides":22,"families":["apt"],"paths":["{{home}}/rt/bin"],"check":{"argv":["fake","--version"],"pattern":"^v(\\d+)\\."}""",
    """
      #!/bin/sh
      set -eu
      mkdir -p "${'$'}HOME/rt/bin"
      printf '#!/bin/sh\necho v%s.1.0\n' $installs > "${'$'}HOME/rt/bin/fake"
      chmod +x "${'$'}HOME/rt/bin/fake"
      touch "${'$'}HOME/installed"
      exit 0
    """.trimIndent(),
  )

  private fun run(atLeast: String, installs: Int): Pair<Int, String> {
    val kind = Runtimes.kind(
      """"install":{"steps":["echo step > {{home}}/step"]},"versionCheck":{"argv":["{{home}}/rt/bin/fake","--version"],"pattern":"(.+)"}""",
      "\"fake$atLeast\"",
    )
    val plan = InstallRenderer.plan(kind, RuntimeBinding.bind(kind, mapOf("fake" to plugin(installs))), "apt")!!
    return Sh.run(plan.script, home = home)
  }

  private fun present(major: Int) {
    File(home, "rt/bin").mkdirs()
    File(home, "rt/bin/fake").apply { writeText(fake(major)) }.setExecutable(true)
  }

  @Test fun installsAMissingRuntime() {
    val (code, out) = run(">=22", installs = 22)
    assertEquals(0, code, out)
    assertEquals(listOf("@phase runtime:fake", "@phase install", "@phase verify", "v22.1.0"), out.lines().filter { it.isNotBlank() })
    assertTrue(File(home, "installed").isFile)
    assertEquals("step\n", File(home, "step").readText())
  }

  @Test fun skipsOneThatIsNewEnough() {
    present(23)
    val (code, out) = run(">=22", installs = 22)
    assertEquals(0, code, out)
    assertFalse(File(home, "installed").exists(), out)
  }

  @Test fun replacesOneThatIsTooOld() {
    present(18)
    val (code, out) = run(">=22", installs = 22)
    assertEquals(0, code, out)
    assertTrue(File(home, "installed").isFile, out)
    present(18)
    File(home, "installed").delete()
    assertEquals(0, run("", installs = 22).first, "no bound: any version passes")
    assertFalse(File(home, "installed").exists())
  }

  // The script reaches sh on stdin: a step, a runtime script or the
  // version check that reads stdin gets /dev/null, never the script's rest.
  @Test fun nothingReadsTheScriptAsInput() {
    val reads = Runtimes.plugin(
      """"id":"fake","provides":22,"families":["apt"],"paths":["{{home}}/rt/bin"],"check":{"argv":["fake","--version"],"pattern":"^v(\\d+)\\."}""",
      "cat > \"${'$'}HOME/runtime-stdin\"\nmkdir -p \"${'$'}HOME/rt/bin\"\nprintf '#!/bin/sh\\necho v22.1.0\\n' > \"${'$'}HOME/rt/bin/fake\"\nchmod +x \"${'$'}HOME/rt/bin/fake\"\n",
    )
    val kind = Runtimes.kind(
      """"install":{"steps":["cat > {{home}}/step-stdin","echo after > {{home}}/after"]},"versionCheck":{"argv":["cat"],"pattern":"(.*)"}""",
      "\"fake\"",
    )
    val plan = InstallRenderer.plan(kind, RuntimeBinding.bind(kind, mapOf("fake" to reads)), "apt")!!
    val (code, out) = Sh.run(plan.script, home = home)
    assertEquals(0, code, out)
    assertEquals(listOf("", "", "after\n"), listOf("runtime-stdin", "step-stdin", "after").map { File(home, it).readText() })
    assertTrue(out.lines().last { it.isNotBlank() } == "@phase verify", out)
  }

  // A step that fails until its third run: `n` counts the runs.
  private val flaky = "n=$(cat {{home}}/n 2>/dev/null || echo 0); n=$((n + 1)); echo ${'$'}n > {{home}}/n; [ ${'$'}n -ge 3 ]"

  private fun steps(vararg steps: String, retries: String = "") = Runtimes.kind(
    "\"install\":{\"steps\":[${steps.joinToString { JsonPrimitive(it).toString() }}]$retries}," +
      "\"versionCheck\":{\"argv\":[\"echo\",\"v1\"],\"pattern\":\"(.+)\"}",
  )

  private fun runRetried(plan: InstallPlan): Pair<Int, String> =
    Sh.run("sleep() { echo \"${'$'}1\" >> \"${'$'}HOME/slept\"; }\n" + plan.script, home = home)

  private fun lines(out: String) = out.lines().filter { it.isNotBlank() }

  // The form the host reads (phonecando-linux): the whole line, n of max.
  private val RETRY_LINE = Regex("@retry [A-Za-z0-9][A-Za-z0-9:._-]{0,63} [0-9]{1,3}/[0-9]{1,3}")

  private fun file(name: String) = File(home, name).takeIf { it.exists() }?.readLines().orEmpty()

  @Test fun aStepThatFailsTwiceRunsAThirdTime() {
    val (code, out) = runRetried(InstallRenderer.plan(steps(flaky, "echo after > {{home}}/after"), emptyList(), "apt")!!)
    assertEquals(0, code, out)
    assertEquals(listOf("@phase install", "@retry install 2/3", "@retry install 3/3", "@phase verify", "v1"), lines(out))
    assertEquals(listOf("3"), file("n"))
    assertEquals(listOf("5", "10"), file("slept"), "5 s times the attempt that failed")
    assertTrue(out.lines().all { !it.startsWith("@retry") || RETRY_LINE.matches(it) }, out)
    assertEquals(listOf("after"), file("after"))
  }

  // Three attempts by default; set -e holds inside a step, so `false`
  // fails it; the script exits with the step's status and runs nothing
  // after it, the version check included.
  @Test fun aStepThatAlwaysFailsEndsTheInstallAfterThreeAttempts() {
    val kind = steps("echo try >> {{home}}/tries; false; touch {{home}}/masked", "touch {{home}}/after")
    val plan = InstallRenderer.plan(kind, emptyList(), "apt")!!
    val (code, out) = runRetried(plan)
    assertEquals(1, code, out)
    assertEquals(listOf("@phase install", "@retry install 2/3", "@retry install 3/3"), lines(out))
    assertEquals(List(3) { "try" }, file("tries"))
    assertEquals(listOf("5", "10"), file("slept"))
    assertFalse(File(home, "masked").exists(), "set -e stops the step at false")
    assertFalse(File(home, "after").exists(), "nothing after the failed step runs")
    val status = InstallRenderer.updatePlan(
      Runtimes.kind(""""install":{},"update":{"steps":["exit 7"]},"versionCheck":{"argv":["echo"],"pattern":"(.*)"}"""), emptyList(), "apt",
    )!!
    val (updateCode, updateOut) = runRetried(status)
    assertEquals(7, updateCode, updateOut)
    assertEquals(listOf("@phase update", "@retry update 2/3", "@retry update 3/3"), lines(updateOut))
  }

  @Test fun noRetriesRunsAStepOnce() {
    val (code, out) = runRetried(InstallRenderer.plan(steps(flaky, retries = ",\"retries\":0"), emptyList(), "apt")!!)
    assertEquals(1, code, out)
    assertEquals(listOf("@phase install"), lines(out))
    assertEquals(listOf("1"), file("n"))
    assertEquals(emptyList(), file("slept"))
  }

  // The runtime's script fails its first run as a lost DNS lookup would.
  @Test fun aRuntimeScriptRunsAgain() {
    val plugin = Runtimes.plugin(
      """"id":"fake","provides":22,"families":["apt"],"paths":["{{home}}/rt/bin"],"check":{"argv":["fake","--version"],"pattern":"^v(\\d+)\\."}""",
      """
        n=$(cat "${'$'}HOME/rt-n" 2>/dev/null || echo 0); n=$((n + 1)); echo ${'$'}n > "${'$'}HOME/rt-n"
        [ ${'$'}n -ge 2 ] || { echo 'getaddrinfo EAI_AGAIN example.org' >&2; exit 6; }
        mkdir -p "${'$'}HOME/rt/bin"
        printf '#!/bin/sh\necho v22.1.0\n' > "${'$'}HOME/rt/bin/fake"
        chmod +x "${'$'}HOME/rt/bin/fake"
      """.trimIndent(),
    )
    val kind = Runtimes.kind(""""install":{},"versionCheck":{"argv":["fake","--version"],"pattern":"(.+)"}""", "\"fake>=22\"")
    val (code, out) = runRetried(InstallRenderer.plan(kind, RuntimeBinding.bind(kind, mapOf("fake" to plugin)), "apt")!!)
    assertEquals(0, code, out)
    assertEquals(
      listOf("@phase runtime:fake", "getaddrinfo EAI_AGAIN example.org", "@retry runtime:fake 2/3", "@phase verify", "v22.1.0"),
      lines(out),
    )
    assertEquals(listOf("5"), file("slept"))
  }

  @Test fun failsWhenTheInstallDoesNotHelp() {
    val (code, out) = run(">=22", installs = 20)
    assertEquals(1, code, out)
    assertTrue("fake: its install did not give fake>=22" in out, out)
    assertFalse(File(home, "step").exists(), "nothing after the failed phase runs")
  }
}
