package com.phonecando.lre.image.conf

import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.support.ConfParser
import com.phonecando.lre.image.support.Hosts
import com.phonecando.lre.image.support.config
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LaunchConfTest {
    private val r = "/data/user/0/com.phonecando.app/files/images/d1"
    private val alt = "/data/data/com.phonecando.app/files/images/d1"
    private val lib = Hosts.LIB

    private fun debian(config: ImageConfig? = null) = Detection(
        os = OsInfo("debian", "12", emptyList(), "Debian GNU/Linux 12 (bookworm)", PackageFamily.APT, "/bin/bash"),
        config = config, hasBash = true, hasSh = true, busyboxSh = null,
    )

    private fun alpine(config: ImageConfig? = null) = Detection(
        os = OsInfo("alpine", "3.22.2", emptyList(), "Alpine Linux v3.22", PackageFamily.APK, "/bin/sh"),
        config = config, hasBash = false, hasSh = true, busyboxSh = null,
    )

    @Test
    fun `golden launch conf for two data-dir spellings and bash`() {
        val expected = """
            # Written by PhoneCanDo image setup before every engine start (format: lre/launcher/src/conf.h). Edits are lost.
            arg $lib/libproot.so
            arg -L
            arg --link2symlink
            arg --sysvipc
            arg -0
            arg --kernel-release=6.1.0-phonecando
            arg --rootfs=$r/rootfs
            arg --bind=/dev
            arg --bind=/proc
            arg --bind=/sys
            arg --bind=/dev/urandom:/dev/random
            arg --bind=/proc/self/fd:/dev/fd
            arg --bind=/proc/self/fd/0:/dev/stdin
            arg --bind=/proc/self/fd/1:/dev/stdout
            arg --bind=/proc/self/fd/2:/dev/stderr
            arg --bind=$r/run/shm:/dev/shm
            arg --bind=$r/run/proc/loadavg:/proc/loadavg
            arg --bind=$r/run/proc/stat:/proc/stat
            arg --bind=$r/run/proc/uptime:/proc/uptime
            arg --bind=$r/run/proc/version:/proc/version
            arg --bind=$r/run/proc/vmstat:/proc/vmstat
            arg --bind=$r/home:/root
            arg --bind=$r/tmp:/tmp
            arg --bind=$r/home:$r/home
            arg --bind=$r/home:$alt/home
            arg --bind=$r/tmp:$r/tmp
            arg --bind=$r/tmp:$alt/tmp
            arg --bind=$r/run/l2s:$r/run/l2s
            unset LD_*
            unset OPENCODE_SERVER_PASSWORD
            unset PHONECANDO_BRIDGE_TOKEN
            unset PHONECANDO_BRIDGE_URL
            set PROOT_LOADER=$lib/libproot-loader.so
            set PROOT_TMP_DIR=$r/run/proot-tmp
            set PROOT_L2S_DIR=$r/run/l2s
            set PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
            set SHELL=/bin/bash
            set USER=root
            set LOGNAME=root
            set LANG=C.UTF-8
            same $r/home
            same $alt/home
            same $r/tmp
            same $alt/tmp
            home /root

        """.trimIndent()
        assertEquals(expected, LaunchConf.build(Hosts.phoneLayout, Hosts.phone, debian()))
    }

    @Test
    fun `no bash maps bash to the shell`() {
        val conf = ConfParser.parse(LaunchConf.build(Hosts.phoneLayout, Hosts.phone, alpine()))
        assertEquals(listOf("bash" to "/bin/sh"), conf.maps)
        assertEquals("/bin/sh", conf.command("bash"))
        assertEquals("/bin/sh", conf.command("$lib/libphonecando_launch.so"))
        assertEquals("git", conf.command("/x/shims/git"))
        assertTrue("SHELL=/bin/sh" in conf.sets)
    }

    @Test
    fun `no sh maps sh to the shell too`() {
        val ashOnly = alpine().copy(os = alpine().os.copy(shell = "/bin/ash"), hasSh = false)
        val conf = ConfParser.parse(LaunchConf.build(Hosts.phoneLayout, Hosts.phone, ashOnly))
        assertEquals(listOf("bash" to "/bin/ash", "sh" to "/bin/ash"), conf.maps)
    }

    @Test
    fun `image config PATH and LANG replace our defaults, other vars pass on`() {
        val conf = ConfParser.parse(
            LaunchConf.build(
                Hosts.phoneLayout, Hosts.phone,
                debian(config("PATH=/usr/local/bin:/usr/bin:/bin", "LANG=en_US.UTF-8", "NODE_VERSION=22.11.0", "LD_PRELOAD=/x.so")),
            ),
        )
        assertTrue("PATH=/usr/local/bin:/usr/bin:/bin" in conf.sets)
        assertTrue("LANG=en_US.UTF-8" in conf.sets)
        assertFalse("LANG=C.UTF-8" in conf.sets)
        assertTrue("NODE_VERSION=22.11.0" in conf.sets)
        assertFalse(conf.sets.any { it.startsWith("LD_") })
    }

    @Test
    fun `parsed by the launcher rules, the plan keeps host paths and drops secrets`() {
        val conf = ConfParser.parse(LaunchConf.build(Hosts.phoneLayout, Hosts.phone, debian()))
        assertEquals("$lib/libproot.so", conf.args.first())
        assertEquals("$alt/home/projects/app", conf.cwd("$alt/home/projects/app"))
        assertEquals("$r/tmp", conf.cwd("$r/tmp"))
        assertEquals("/root", conf.cwd("/data/user/0/com.phonecando.app/files"))
        assertEquals("/root", conf.cwd("$r/home-other"))

        val env = conf.env(
            mapOf(
                "HOME" to "$r/home", "TMPDIR" to "$r/tmp", "PATH" to "$r/shims:/system/bin",
                "LD_PRELOAD" to "libsigchain.so", "LD_LIBRARY_PATH" to "/x", "OPENCODE_SERVER_PASSWORD" to "s",
                "PHONECANDO_BRIDGE_TOKEN" to "t", "PHONECANDO_BRIDGE_URL" to "u", "TERM" to "xterm-256color",
                "PHONECANDO_IMAGE" to r,
            ),
        )
        assertEquals("$r/home", env["HOME"])
        assertEquals("$r/tmp", env["TMPDIR"])
        assertEquals("xterm-256color", env["TERM"])
        assertEquals(r, env["PHONECANDO_IMAGE"])
        assertEquals("/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", env["PATH"])
        assertEquals("$lib/libproot-loader.so", env["PROOT_LOADER"])
        listOf("LD_PRELOAD", "LD_LIBRARY_PATH", "OPENCODE_SERVER_PASSWORD", "PHONECANDO_BRIDGE_TOKEN", "PHONECANDO_BRIDGE_URL")
            .forEach { assertFalse(it in env, it) }
    }

    @Test
    fun `a single data-dir spelling binds and lists once`() {
        val host = Hosts.phone.copy(dataDirSpellings = listOf("/data/user/0/com.phonecando.app"))
        val conf = ConfParser.parse(LaunchConf.build(Hosts.phoneLayout, host, debian()))
        assertEquals(listOf("$r/home", "$r/tmp"), conf.same)
    }

    @Test
    fun `every value is newline-checked`() {
        val badLayout = com.phonecando.lre.api.ImageLayout(java.io.File("/data/user/0/x/images/a\nb"))
        assertFailsWith<LreException.UnsafeEntry> { LaunchConf.build(badLayout, Hosts.phone, debian()) }
        assertFailsWith<LreException.UnsafeEntry> {
            LaunchConf.build(Hosts.phoneLayout, Hosts.phone.copy(libDir = "/data/app/lib\n/arm64"), debian())
        }
        assertFailsWith<LreException.UnsafeEntry> {
            LaunchConf.build(Hosts.phoneLayout, Hosts.phone, debian().copy(os = debian().os.copy(shell = "/bin/ba\rsh")))
        }
        assertFailsWith<LreException.UnsafeEntry> { Directive.SetEnv("K", "a\nb").line() }
        assertFailsWith<LreException.UnsafeEntry> { Directive.Arg("x\u0000").line() }
        assertFailsWith<LreException.UnsafeEntry> { Directive.Same("relative").line() }
        assertFailsWith<LreException.UnsafeEntry> { Directive.MapCommand("bash", "/bin/my sh").line() }
        assertFailsWith<LreException.UnsafeEntry> { Directive.Unset("A*B").line() }
        assertFailsWith<LreException.UnsafeEntry> { Directive.SetEnv("1BAD", "x").line() }
    }

    @Test
    fun `a relative lib dir or a colon in a bind path is refused`() {
        assertFailsWith<LreException.UnsafeEntry> {
            LaunchConf.build(Hosts.phoneLayout, Hosts.phone.copy(libDir = "lib/arm64"), debian())
        }
        val colon = com.phonecando.lre.api.ImageLayout(java.io.File("/data/user/0/x/images/a:b"))
        assertFailsWith<LreException.UnsafeEntry> { LaunchConf.build(colon, Hosts.phone, debian()) }
    }

    @Test
    fun `the launcher's size limits hold`() {
        val many = (1..LaunchConf.MAX_LINES).map { "V$it=x" }
        assertFailsWith<LreException.TooLarge> {
            LaunchConf.build(Hosts.phoneLayout, Hosts.phone, debian(config(*many.toTypedArray())))
        }
        val huge = "BIG=" + "x".repeat(LaunchConf.MAX_BYTES)
        assertFailsWith<LreException.TooLarge> {
            LaunchConf.build(Hosts.phoneLayout, Hosts.phone, debian(config(huge)))
        }
    }
}
