package com.phonecando.lre.cli

import com.phonecando.lre.api.LreException
import com.phonecando.lre.cli.args.UsageError
import com.phonecando.lre.cli.report.ExitCode
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CliTest {
    @TempDir
    lateinit var dir: File

    private val out = ByteArrayOutputStream()
    private val err = ByteArrayOutputStream()

    private fun cli(vararg args: String) = Cli.main(args.toList(), PrintStream(out, true), PrintStream(err, true))

    private fun guarded(block: () -> Int) = Cli.guarded(PrintStream(err, true), block)

    private val stderr get() = err.toString()

    @Test
    fun `help prints usage and exits 0`() {
        assertEquals(ExitCode.OK, cli("help"))
        assertTrue(out.toString().contains("cli setup (--ref <image ref> | --tarball"))
    }

    @Test
    fun `usage errors exit 2 and say why`() {
        assertEquals(ExitCode.USAGE, cli("pull", "alpine"))
        assertTrue(stderr.startsWith("lre-cli: unknown command 'pull'\n"), stderr)
    }

    @Test
    fun `typed runtime errors exit 3 with code and message`() {
        assertEquals(ExitCode.RUNTIME, guarded { throw LreException.NoArm64("docker.io/library/archlinux:latest") })
        assertEquals("no_arm64: docker.io/library/archlinux:latest has no linux/arm64 build\n", stderr)
    }

    @Test
    fun `anything else exits 1`() {
        assertEquals(ExitCode.OTHER, guarded { error("boom") })
        assertTrue(stderr.startsWith("lre-cli: IllegalStateException: boom\n"), stderr)
        assertEquals(ExitCode.USAGE, guarded { throw UsageError("x") })
    }

    @Test
    fun `run and env on a dir that was never set up are not_found`() {
        assertEquals(ExitCode.RUNTIME, cli("run", "--image-dir", dir.path, "--", "true"))
        assertTrue(stderr.startsWith("not_found: run/engine.env under "), stderr)
    }

    @Test
    fun `env of an image with no Linux is corrupt`() {
        File(dir, "run").mkdirs()
        File(dir, "run/engine.env").writeText("HOME=/h\nTMPDIR=/t\n")
        assertEquals(ExitCode.RUNTIME, cli("env", "--image-dir", dir.path))
        assertTrue(stderr.startsWith("corrupt: corrupt run/engine.env (no SHELL"), stderr)
    }

    @Test
    fun `env prints export lines`() {
        File(dir, "run").mkdirs()
        File(dir, "run/engine.env").writeText("HOME=/h\nSHELL=/i/shims/bash\n")
        assertEquals(ExitCode.OK, cli("env", "--image-dir", dir.path))
        assertEquals("export HOME='/h'\nexport SHELL='/i/shims/bash'\n", out.toString())
    }

    @Test
    fun `run passes the command's exit code through with engine env applied`() {
        File(dir, "run").mkdirs()
        // A stand-in SHELL: /bin/sh itself, so this needs no proot.
        File(dir, "run/engine.env").writeText("SHELL=/bin/sh\nLRE_CLI_TEST=from-engine-env\n")
        val marker = File(dir, "marker")
        val command = "printf %s \"\$LRE_CLI_TEST\" > '${marker.path}'; exit 7"
        assertEquals(7, cli("run", "--image-dir", dir.path, "--cwd", dir.path, "--", command))
        assertEquals("from-engine-env", marker.readText())
    }

    @Test
    fun `run kills a command past its timeout`() {
        File(dir, "run").mkdirs()
        File(dir, "run/engine.env").writeText("SHELL=/bin/sh\n")
        assertEquals(ExitCode.TIMEOUT, cli("run", "--image-dir", dir.path, "--timeout", "1", "--", "sleep 30"))
        assertTrue(stderr.contains("timed out after 1s"), stderr)
    }
}
