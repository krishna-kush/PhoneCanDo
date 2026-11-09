package com.phonecando.lre.cli.args

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ArgParserTest {
    private fun parse(vararg words: String) = ArgParser.parse(words.toList())

    private fun usage(vararg words: String): String = assertFailsWith<UsageError> { parse(*words) }.message!!

    @Test
    fun `setup from a registry ref with every option`() {
        val command = parse(
            "setup", "--ref", "debian:stable", "--image-dir", "/w/images/c1", "--lib-dir=/w/lib",
            "--data-dir", "/w", "--data-dir=/alias/w", "--blobs", "/w/blobs", "--free-bytes", "1000",
            "--tool", "bash", "--tool=rg",
        )
        assertEquals(
            Command.Setup(
                BaseSource.Registry("debian:stable"),
                HostArgs("/w/images/c1", "/w/lib", listOf("/w", "/alias/w")),
                blobs = "/w/blobs",
                freeBytes = 1000,
                tools = listOf("bash", "rg"),
            ),
            command,
        )
    }

    @Test
    fun `setup from a tarball with defaults`() {
        assertEquals(
            Command.Setup(BaseSource.Tarball("rootfs.tar.xz"), HostArgs("img", "lib", emptyList()), null, null, emptyList()),
            parse("setup", "--tarball", "rootfs.tar.xz", "--image-dir", "img", "--lib-dir", "lib"),
        )
    }

    @Test
    fun `setup needs exactly one source and both dirs`() {
        assertEquals("--ref or --tarball is required", usage("setup", "--image-dir", "i", "--lib-dir", "l"))
        assertEquals(
            "give --ref or --tarball, not both",
            usage("setup", "--ref", "a", "--tarball", "b", "--image-dir", "i", "--lib-dir", "l"),
        )
        assertEquals("--lib-dir is required", usage("setup", "--ref", "a", "--image-dir", "i"))
        assertEquals("--image-dir is required", usage("setup", "--ref", "a", "--lib-dir", "l"))
    }

    @Test
    fun `bad values are usage errors`() {
        val base = arrayOf("setup", "--ref", "a", "--image-dir", "i", "--lib-dir", "l")
        assertEquals("--free-bytes must be a whole number of bytes", usage(*base, "--free-bytes", "-1"))
        assertEquals("--free-bytes must be a whole number of bytes", usage(*base, "--free-bytes", "10G"))
        assertEquals("--ref given twice", usage(*base, "--ref", "b"))
        assertEquals("unknown option --cwd for setup", usage(*base, "--cwd", "/"))
        assertEquals("unexpected argument 'extra'", usage(*base, "extra"))
        assertEquals("--blobs needs a value", usage(*base, "--blobs"))
        assertEquals("--blobs needs a value", usage(*base, "--blobs="))
        assertEquals("--blobs needs a value", usage(*base, "--blobs", "--free-bytes", "1"))
        assertEquals("setup takes no command after --", usage(*base, "--", "ls"))
    }

    @Test
    fun `refresh and env`() {
        assertEquals(
            Command.Refresh(HostArgs("i", "l", listOf("/d"))),
            parse("refresh", "--image-dir", "i", "--lib-dir", "l", "--data-dir", "/d"),
        )
        assertEquals(Command.Env("i"), parse("env", "--image-dir", "i"))
        assertEquals("--image-dir is required", usage("env"))
    }

    @Test
    fun `run joins the words after -- into one command string`() {
        assertEquals(
            Command.Run("i", "echo ok; id -u", cwd = null, timeoutSeconds = null),
            parse("run", "--image-dir", "i", "--", "echo ok; id -u"),
        )
        assertEquals(
            Command.Run("i", "git commit -m x --allow-empty", cwd = "/p", timeoutSeconds = 60),
            parse("run", "--image-dir", "i", "--cwd", "/p", "--timeout=60", "--", "git", "commit", "-m", "x", "--allow-empty"),
        )
    }

    @Test
    fun `run needs a command and a sane timeout`() {
        assertEquals("run needs -- and the command", usage("run", "--image-dir", "i"))
        assertEquals("run needs a command after --", usage("run", "--image-dir", "i", "--"))
        assertEquals("run needs a command after --", usage("run", "--image-dir", "i", "--", " "))
        assertEquals(
            "--timeout must be a positive number of seconds",
            usage("run", "--image-dir", "i", "--timeout", "0", "--", "true"),
        )
    }

    @Test
    fun `help in any spelling, but not inside a run command`() {
        assertEquals(Command.Help, parse("help"))
        assertEquals(Command.Help, parse("--help"))
        assertEquals(Command.Help, parse("setup", "-h"))
        assertEquals(Command.Run("i", "ls --help", null, null), parse("run", "--image-dir", "i", "--", "ls", "--help"))
    }

    @Test
    fun `no or unknown command`() {
        assertEquals("no command given", usage())
        assertEquals("unknown command 'pull'", usage("pull"))
    }
}
