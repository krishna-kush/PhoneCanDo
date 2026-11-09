package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ManifestDecoder
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

// InstallRenderer on the gemini-cli fixture (node>=22, packages per family,
// steps, update, version check, 3 retries): the phases, the lines each
// family gets, which units are retried, what it refuses, and the script is
// valid sh.
class InstallRendererTest {
  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))
  private val gemini = ManifestDecoder.decode(File(fixtures, "valid/gemini-cli.json").readText())
  private val runtimes = RuntimeBinding.bind(gemini, Runtimes.catalog(fixtures))

  private fun plan(family: String) = checkNotNull(InstallRenderer.plan(gemini, runtimes, family))

  @Test fun installsRuntimesThenPackagesThenStepsThenVerifies() {
    val apt = plan("apt")
    assertEquals(listOf("runtime:node", "packages", "install", "verify"), apt.phases)
    assertEquals(1200, apt.timeoutSec)
    val script = apt.script
    for (line in listOf(
      "set -eu",
      "  PATH=\"\${HOME}\"'/.local/opt/node/bin':\"\$PATH\"",
      "  echo '@phase runtime:node'",
      "    [ -n \"\$v\" ] && [ \"\$v\" -ge 22 ]",
      "echo 'would run install/glibc.sh'",
      "    phonecando_retry 'runtime:node' 4 sh -c \"\$phonecando_script\" 'runtime-node'",
      "    apt-get update",
      "    DEBIAN_FRONTEND=noninteractive apt-get install -y 'git' 'ripgrep'",
      "  phonecando_retry 'packages' 4 phonecando_step",
      "    npm install -g --prefix \"\$HOME/.local\" @google/gemini-cli@latest",
      "  phonecando_retry 'install' 4 phonecando_step",
      "  \"\${HOME}\"'/.local/bin/gemini' '--version'",
      "phonecando_install </dev/null",
    )) {
      assertTrue(line in script.lines(), "no line <$line> in\n$script")
    }
    assertTrue("grep -oE '^v([0-9]+)\\.'" in script, script)
    assertTrue("sed -nE 's#^(v([0-9]+)\\.)\$#\\2#p'" in script, script)
    val at = apt.phases.map { script.indexOf("@phase $it") }
    assertEquals(at.sorted(), at, "phases come in order")
  }

  @Test fun eachFamilyGetsItsOwnPackagesAndRuntimeScript() {
    assertTrue("echo 'would run install/apk.sh'" in plan("apk").script.lines())
    assertTrue("    apk update" in plan("apk").script.lines())
    assertTrue("    apk add 'git' 'ripgrep'" in plan("apk").script.lines())
    assertTrue("    dnf -y install 'git'" in plan("dnf").script.lines(), "the * fallback")
    assertTrue("    pacman -Sy --noconfirm --needed 'git'" in plan("pacman").script.lines())
    assertTrue("    zypper -n install 'git'" in plan("zypper").script.lines())
  }

  @Test fun everyFamilyHasAPackageCommand() {
    for (family in com.phonecando.agents.kit.manifest.PackageFamilies.ALL) {
      assertTrue(PackageCommands.lines(family, "'x'")!!.last().endsWith(" 'x'"), family)
    }
    assertNull(PackageCommands.lines("nix", "'x'"))
  }

  @Test fun refusesAFamilyTheKindOrARuntimeLacks() {
    val e = assertFailsWith<NoRecipe> { plan("xbps") }
    assertEquals(listOf("gemini-cli", "xbps", listOf("apt", "apk", "dnf", "pacman", "zypper")), listOf(e.kind, e.family, e.supported))
    // Its own families are any; the runtime's are not.
    val anyOwn = Runtimes.kind(""""install":{},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""", "\"r\"")
    val apkOnly = Runtimes.plugin(""""id":"r","provides":1,"families":["apk"],"check":{"argv":["r"],"pattern":"(1)"}""", "")
    val narrow = RuntimeBinding.bind(anyOwn, mapOf("r" to apkOnly))
    assertEquals(listOf("apk"), RuntimeBinding.families(anyOwn, narrow))
    assertFailsWith<NoRecipe> { InstallRenderer.plan(anyOwn, narrow, "apt") }
    // No runtimes, no families: any family, even one with no package command, while it needs no packages.
    val bare = Runtimes.kind(""""install":{"steps":["true"]},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""")
    assertEquals(listOf("install", "verify"), InstallRenderer.plan(bare, emptyList(), "nix")!!.phases)
    val packaged = Runtimes.kind(""""install":{"packages":{"*":["x"]}},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""")
    assertFailsWith<NoRecipe> { InstallRenderer.plan(packaged, emptyList(), "nix") }
  }

  @Test fun updatesEnsureTheRuntimesAgain() {
    val update = checkNotNull(InstallRenderer.updatePlan(gemini, runtimes, "apt"))
    assertEquals(listOf("runtime:node", "update", "verify"), update.phases)
    assertTrue("    npm install -g --prefix \"\$HOME/.local\" @google/gemini-cli@latest" in update.script.lines())
    assertTrue("  phonecando_retry 'update' 4 phonecando_step" in update.script.lines(), update.script)
    assertTrue("apt-get update" !in update.script)
  }

  @Test fun nothingToInstallOrUpdate() {
    val top = Runtimes.kind(""""surfaces":{"home":"tui"}""")
    assertNull(InstallRenderer.plan(top, emptyList(), "apt"))
    assertNull(InstallRenderer.updatePlan(top, emptyList(), "apt"))
    assertNull(InstallRenderer.updatePlan(gemini.copy(update = null), runtimes, "apt"))
  }

  @Test fun homeIsTheShellsHome() {
    val kind = Runtimes.kind(
      """"install":{"steps":["cd {{home}} && echo {{home}}x"]},"versionCheck":{"argv":["{{home}}/bin/it's","a{{home}}b{{home}}"],"pattern":"(.+)"}""",
    )
    val lines = InstallRenderer.plan(kind, emptyList(), "apt")!!.script.lines()
    assertTrue("    cd \${HOME} && echo \${HOME}x" in lines, lines.joinToString("\n"))
    assertTrue("  \"\${HOME}\"'/bin/it'\\''s' 'a'\"\${HOME}\"'b'\"\${HOME}\"" in lines, lines.joinToString("\n"))
  }

  // Each runtime script, the packages (refresh and install as one unit) and
  // each step goes through phonecando_retry; the version check does not.
  @Test fun retriesEveryNetworkUnitButNotTheCheck() {
    val lines = plan("apt").script.lines()
    assertEquals(1, lines.count { it == "phonecando_retry() {" }, "defined once")
    assertTrue(lines.indexOf("phonecando_retry() {") < lines.indexOf("phonecando_install() {"), "at the top")
    assertTrue("    echo \"@retry \$phonecando_phase \$phonecando_try/\$phonecando_max\"" in lines)
    assertTrue("    sleep \$((phonecando_try * 5 - 5))" in lines)
    assertEquals(
      listOf("'runtime:node' 4 sh", "'packages' 4 phonecando_step", "'install' 4 phonecando_step"),
      lines.filter { it.trimStart().startsWith("phonecando_retry '") }.map { it.trim().split(" ").drop(1).take(3).joinToString(" ") },
    )
    val packages = lines.indexOf("    apt-get update")
    assertEquals(
      listOf(
        "  phonecando_step() {",
        "    apt-get update",
        "    DEBIAN_FRONTEND=noninteractive apt-get install -y 'git' 'ripgrep'",
        "  }",
      ),
      lines.subList(packages - 1, packages + 3),
    )
    val verify = lines.indexOf("  echo '@phase verify'")
    assertEquals(listOf("  \"\${HOME}\"'/.local/bin/gemini' '--version'", "}"), lines.subList(verify + 1, verify + 3))
  }

  @Test fun eachStepIsItsOwnUnitTwoRetriesByDefault() {
    fun kind(retries: String) = Runtimes.kind(
      """"install":{"steps":["echo one","echo two"]$retries},"update":{"steps":["echo up"]},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""",
    )
    val calls = { script: String -> script.lines().filter { it.trimStart().startsWith("phonecando_retry '") }.map { it.trim() } }
    val step = "phonecando_retry 'install' 3 phonecando_step"
    assertEquals(listOf(step, step), calls(InstallRenderer.plan(kind(""), emptyList(), "apt")!!.script))
    val update = InstallRenderer.updatePlan(kind(""), emptyList(), "apt")!!.script
    assertEquals(listOf("phonecando_retry 'update' 3 phonecando_step"), calls(update))
    val none = InstallRenderer.plan(kind(""","retries":0"""), emptyList(), "apt")!!.script
    assertEquals(List(2) { "phonecando_retry 'install' 1 phonecando_step" }, calls(none))
    assertEquals(listOf("    echo one", "  }"), none.lines().dropWhile { it != "  phonecando_step() {" }.drop(1).take(2))
  }

  @Test fun theScriptIsValidSh() {
    for (family in listOf("apt", "apk", "dnf")) {
      val (code, output) = Sh.run(plan(family).script, "-n")
      assertEquals(0, code, "$family: $output")
    }
  }

  @Test fun refusesARuntimeScriptHoldingTheDelimiter() {
    val plugin = Runtimes.plugin(""""id":"r","provides":1,"families":["apt"],"check":{"argv":["r"],"pattern":"(1)"}""", "a\nPHONECANDO_RUNTIME_SCRIPT\nb")
    val kind = Runtimes.kind(""""install":{},"versionCheck":{"argv":["demo"],"pattern":"(.+)"}""", "\"r\"")
    assertFailsWith<IllegalArgumentException> { InstallRenderer.plan(kind, RuntimeBinding.bind(kind, mapOf("r" to plugin)), "apt") }
  }
}
