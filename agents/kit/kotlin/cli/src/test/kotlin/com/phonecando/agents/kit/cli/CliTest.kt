package com.phonecando.agents.kit.cli

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// render-install on a tree laid out as agents/ is: agents/image/<id>/agent.json
// and agents/runtimes/<id>/, made from the schema's fixtures.
class CliTest {
  @TempDir lateinit var root: File

  private val fixtures = File(checkNotNull(System.getProperty("phonecando.fixtures")))

  private fun tree(kind: String = "gemini-cli") {
    File(root, "agents/image/$kind").mkdirs()
    File(fixtures, "valid/$kind.json").copyTo(File(root, "agents/image/$kind/agent.json"))
    if (File(root, "agents/runtimes").exists()) return
    val node = File(root, "agents/runtimes/node/install").apply { mkdirs() }.parentFile
    File(fixtures, "runtime/valid/node.json").copyTo(File(node, "runtime.json"))
    File(node, "install/glibc.sh").writeText("echo glibc\n")
    File(node, "install/apk.sh").writeText("echo apk\n")
  }

  private fun run(vararg args: String): Triple<Int, String, String> {
    val out = ByteArrayOutputStream()
    val err = ByteArrayOutputStream()
    val code = Cli.main(args.toList(), PrintStream(out, true), PrintStream(err, true))
    return Triple(code, out.toString(), err.toString())
  }

  private val kind get() = File(root, "agents/image/gemini-cli").path

  @Test fun printsTheRawScript() {
    tree()
    val (code, out, err) = run("render-install", "--kind", kind, "--family", "apk")
    assertEquals(0, code, err)
    assertTrue(out.startsWith("# gemini-cli: rendered by the kit's InstallRenderer"), out)
    assertTrue("echo apk" in out.lines(), "the runtimes beside the kind, the apk script")
    assertEquals(
      listOf("@phase runtime:node", "@phase packages", "@phase install", "@phase verify"),
      out.lines().filter { "'@phase " in it }.map { it.trim().removePrefix("echo '").removeSuffix("'") },
    )
    assertTrue("phases runtime:node, packages, install, verify; timeout 1200s" in err, err)
    val update = run("render-install", "--update", "--kind", kind, "--family", "apt", "--runtimes", File(root, "agents/runtimes").path)
    assertEquals(0, update.first, update.third)
    assertTrue("echo glibc" in update.second.lines())
  }

  @Test fun failsWhenThereIsNothingToRender() {
    tree()
    val (code, out, err) = run("render-install", "--kind", kind, "--family", "xbps")
    assertEquals(1 to "", code to out)
    assertTrue("gemini-cli cannot be installed on xbps" in err, err)
    val missing = run("render-install", "--kind", kind, "--family", "apt", "--runtimes", File(root, "none").path)
    assertEquals(1, missing.first)
    assertTrue("needs runtime node, which this build does not have" in missing.third, missing.third)
    tree("user-top")
    val top = run("render-install", "--kind", File(root, "agents/image/user-top").path, "--family", "apt")
    assertEquals(1, top.first)
    assertTrue("user.top has no install" in top.third, top.third)
  }

  @Test fun refusesAFolderNotNamedAfterItsRuntime() {
    tree()
    File(root, "agents/runtimes/node").renameTo(File(root, "agents/runtimes/nodejs"))
    val (code, _, err) = run("render-install", "--kind", kind, "--family", "apt")
    assertEquals(1, code)
    assertTrue("runtime node sits in folder nodejs" in err, err)
  }

  @Test fun usage() {
    assertEquals(0, run().first)
    assertEquals(0, run("help").first)
    for (bad in listOf(arrayOf("render"), arrayOf("render-install", "--family", "apt"), arrayOf("render-install", "--kind"), arrayOf("render-install", "--x"))) {
      val (code, _, err) = run(*bad)
      assertEquals(2, code, bad.joinToString(" "))
      assertTrue(Cli.USAGE in err)
    }
  }
}
