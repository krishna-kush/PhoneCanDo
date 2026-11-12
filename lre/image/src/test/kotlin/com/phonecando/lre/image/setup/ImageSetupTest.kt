package com.phonecando.lre.image.setup

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.PackageFamily
import com.phonecando.lre.api.PayloadNames
import com.phonecando.lre.image.ImageSetup
import com.phonecando.lre.image.proc.FakeProc
import com.phonecando.lre.image.support.ConfParser
import com.phonecando.lre.image.support.Distros
import com.phonecando.lre.image.support.Hosts
import com.phonecando.lre.image.support.Tree
import com.phonecando.lre.image.support.TreeLayer
import com.phonecando.lre.image.support.TreeUnpacker
import com.phonecando.lre.image.support.treeBase
import com.phonecando.lre.image.tools.MissingTools
import com.phonecando.network.CancelSignal
import com.phonecando.network.Progress
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Paths
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ImageSetupTest {
    @TempDir
    lateinit var dir: File

    private val layout get() = ImageLayout(File(dir, "files/images/d1"))
    private val host get() = Hosts.local(dir)
    private val big = Long.MAX_VALUE
    private val tools = listOf("bash", "git", "rg")

    @Test
    fun `create turns a debian base into a ready image`() {
        val unpacker = TreeUnpacker()
        val result = ImageSetup(unpacker).create(layout, treeBase { Distros.debian(it) }, host, big)

        assertEquals("debian", result.os?.id)
        assertEquals(PackageFamily.APT, result.os?.family)
        assertEquals(
            MissingTools(listOf("rg"), "apt-get update && apt-get install -y ripgrep"),
            ImageSetup.checkTools(layout, tools),
        )
        assertFalse(result.socketPathTight)
        assertTrue(ImageSetup.isReady(layout))
        assertEquals(SetupStep.entries, SetupState.done(layout))

        listOf(layout.home, layout.tmp, layout.logs, layout.shm, layout.prootTmp, layout.l2s, layout.fakeProc)
            .forEach { assertTrue(it.isDirectory, it.path) }
        FakeProc.NAMES.forEach { assertTrue(File(layout.fakeProc, it).isFile, it) }
        assertTrue(layout.osNote.readText().startsWith("This machine: Debian GNU/Linux 12 (bookworm) (apt)."))

        val env = layout.engineEnv.readLines()
        assertEquals("HOME=${layout.home.path}", env[0])
        assertEquals("PHONECANDO_IMAGE=${layout.root.path}", env[4])

        val conf = ConfParser.parse(layout.launchConf.readText())
        assertEquals("${Hosts.LIB}/${PayloadNames.PROOT}", conf.args.first())
        assertEquals(listOf(layout.home.path, layout.tmp.path), conf.same)
        assertEquals("/root", conf.home)

        assertEquals(
            Paths.get(Hosts.LIB, PayloadNames.LAUNCHER),
            Files.readSymbolicLink(File(layout.shims, "git").toPath()),
        )
        assertEquals("phonecando\n", File(layout.rootfs, "etc/hostname").readText())
    }

    @Test
    fun `alpine lacks every agent tool and maps bash`() {
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.alpine(it) }, host, big)
        assertEquals(MissingTools(tools, "apk add bash git ripgrep"), ImageSetup.checkTools(layout, tools))
        assertEquals(listOf("bash" to "/bin/sh"), ConfParser.parse(layout.launchConf.readText()).maps)
    }

    @Test
    fun `refresh for start drops the bash map once the image has bash`() {
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.alpine(it) }, host, big)
        Tree(layout.rootfs).exe("bin/bash") // what `apk add bash` leaves
        ImageSetup.refreshForStart(layout, host)
        val conf = layout.launchConf.readText()
        assertEquals(emptyList(), ConfParser.parse(conf).maps)
        assertTrue("set SHELL=/bin/bash" in conf.lines(), conf)
    }

    @Test
    fun `an image without a package manager reports tools but no command`() {
        val result = ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.bare(it) }, host, big)
        assertEquals(MissingTools(tools, null), ImageSetup.checkTools(layout, tools))
        assertNull(result.os?.family)
    }

    @Test
    fun `the tools check asks only about the commands it is given`() {
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.alpine(it) }, host, big)
        assertEquals(MissingTools.NONE, ImageSetup.checkTools(layout, emptyList()))
        assertEquals(MissingTools(listOf("rg"), "apk add ripgrep"), ImageSetup.checkTools(layout, listOf("sh", "rg", "rg")))
        Tree(layout.rootfs).exe("usr/bin/rg")
        assertEquals(MissingTools.NONE, ImageSetup.checkTools(layout, listOf("rg")))
        listOf("../bin/sh", "/bin/sh", "rg; reboot", "", "-x").forEach { bad ->
            assertFailsWith<LreException.UnsafeEntry>(bad) { ImageSetup.checkTools(layout, listOf(bad)) }
        }
    }

    @Test
    fun `the tools check needs a finished image and finds nothing missing without Linux`() {
        assertFailsWith<LreException.NotFound> { ImageSetup.checkTools(layout, tools) }
        ImageSetup.android(layout, host)
        assertEquals(MissingTools.NONE, ImageSetup.checkTools(layout, tools))
    }

    @Test
    fun `refresh for start unsets the host's names after the LD_ prefix`() {
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.debian(it) }, host, big)
        assertEquals(listOf("LD_*"), unsets())
        ImageSetup.refreshForStart(layout, host, listOf("ENGINE_PASSWORD", "BRIDGE_*", "LD_*"))
        assertEquals(listOf("LD_*", "ENGINE_PASSWORD", "BRIDGE_*"), unsets())
        ImageSetup.refreshForStart(layout, host)
        assertEquals(listOf("LD_*"), unsets())
        assertFailsWith<LreException.UnsafeEntry> { ImageSetup.refreshForStart(layout, host, listOf("A=B")) }
    }

    private fun unsets() = layout.launchConf.readLines().filter { it.startsWith("unset ") }.map { it.removePrefix("unset ") }

    @Test
    fun `create on a ready image does nothing again`() {
        val unpacker = TreeUnpacker()
        val setup = ImageSetup(unpacker)
        val base = treeBase { Distros.debian(it) }
        val first = setup.create(layout, base, host, big)
        assertEquals(first, setup.create(layout, base, host, big))
        assertEquals(1, unpacker.calls)
    }

    @Test
    fun `a failure at any step resumes at that step`() {
        for (failing in SetupStep.entries) {
            val layout = ImageLayout(File(dir, "resume-${failing.id}"))
            val unpacker = TreeUnpacker()
            var armed = true
            val setup = ImageSetup(unpacker) { step ->
                if (step == failing && armed) {
                    armed = false
                    throw IOException("boom at ${step.id}")
                }
            }
            val base = treeBase { Distros.debian(it) }
            assertFailsWith<IOException>(failing.id) { setup.create(layout, base, Hosts.local(dir), big) }
            assertEquals(SetupStep.entries.take(failing.ordinal), SetupState.done(layout), failing.id)
            assertFalse(ImageSetup.isReady(layout))

            val result = setup.create(layout, base, Hosts.local(dir), big)
            assertEquals("debian", result.os?.id, failing.id)
            assertTrue(ImageSetup.isReady(layout), failing.id)
            assertEquals(1, unpacker.calls, failing.id)
            assertTrue(layout.launchConf.isFile, failing.id)
        }
    }

    @Test
    fun `an interrupted unpack starts again from an empty rootfs`() {
        var attempt = 0
        val base = BaseImage(
            listOf(
                TreeLayer { root ->
                    attempt++
                    if (attempt == 1) {
                        Tree(root).file("half-written", "x")
                        throw IOException("killed mid-layer")
                    }
                    Distros.debian(root)
                },
            ),
            null,
        )
        val setup = ImageSetup(TreeUnpacker())
        assertFailsWith<IOException> { setup.create(layout, base, host, big) }
        assertEquals(listOf(SetupStep.SPACE), SetupState.done(layout))
        setup.create(layout, base, host, big)
        assertFalse(File(layout.rootfs, "half-written").exists())
        assertTrue(File(layout.rootfs, "usr/bin/apt-get").isFile)
    }

    @Test
    fun `no shell fails detection and stays resumable`() {
        val setup = ImageSetup(TreeUnpacker())
        assertFailsWith<LreException.NoShell> { setup.create(layout, treeBase { Distros.noShell(it) }, host, big) }
        assertEquals(listOf(SetupStep.SPACE, SetupStep.UNPACK), SetupState.done(layout))
    }

    @Test
    fun `too little space is a typed error before anything is unpacked`() {
        val unpacker = TreeUnpacker()
        val base = BaseImage(listOf(TreeLayer(size = 1000) { Distros.debian(it) }), null)
        val e = assertFailsWith<LreException.NoSpace> { ImageSetup(unpacker).create(layout, base, host, 2000) }
        assertEquals(2500, e.needed)
        assertEquals(0, unpacker.calls)
        assertEquals(2500, SpaceCheck.estimate(base))
    }

    @Test
    fun `cancel stops between steps`() {
        val cancelled = CancelSignal { true }
        assertFailsWith<LreException.Cancelled> {
            ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.debian(it) }, host, big, cancel = cancelled)
        }
        assertFalse(ImageSetup.isReady(layout))
    }

    @Test
    fun `progress names each step in order`() {
        val steps = ArrayList<String>()
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.debian(it) }, host, big, sink = { p: Progress -> steps += p.step })
        assertEquals(SetupStep.entries.map { it.id }, steps)
    }

    @Test
    fun `android image has HOME and TMPDIR only`() {
        val result = ImageSetup.android(layout, host)
        assertNull(result.os)
        assertTrue(ImageSetup.isReady(layout))
        assertEquals("HOME=${layout.home.path}\nTMPDIR=${layout.tmp.path}\n", layout.engineEnv.readText())
        assertFalse(layout.osNote.exists())
        assertFalse(layout.launchConf.exists())
        assertFalse(layout.rootfs.exists())
        assertTrue(layout.home.isDirectory && layout.tmp.isDirectory && layout.logs.isDirectory)
        ImageSetup.refreshForStart(layout, host)
        assertEquals("HOME=${layout.home.path}\nTMPDIR=${layout.tmp.path}\n", layout.engineEnv.readText())
    }

    @Test
    fun `adding linux to an android image keeps home`() {
        ImageSetup.android(layout, host)
        File(layout.home, "projects/app/main.py").apply { parentFile.mkdirs(); writeText("print(1)") }
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.debian(it) }, host, big)
        assertEquals("print(1)", File(layout.home, "projects/app/main.py").readText())
        assertTrue(layout.osNote.isFile)
        assertTrue(layout.engineEnv.readText().contains("PHONECANDO_IMAGE="))
    }

    @Test
    fun `refresh for start follows the phone's DNS and a moved lib dir`() {
        ImageSetup(TreeUnpacker()).create(layout, treeBase { Distros.debian(it) }, host, big)
        val moved = Hosts.local(dir, libDir = "/data/app/~~new==/lib/arm64", dns = listOf("9.9.9.9"))
        Tree(layout.rootfs).exe("usr/bin/rg")

        ImageSetup.refreshForStart(layout, moved)

        assertEquals("nameserver 9.9.9.9\n", File(layout.rootfs, "etc/resolv.conf").readText())
        assertEquals(
            Paths.get("/data/app/~~new==/lib/arm64", PayloadNames.LAUNCHER),
            Files.readSymbolicLink(File(layout.shims, "rg").toPath()),
        )
        assertEquals("/data/app/~~new==/lib/arm64/libproot.so", ConfParser.parse(layout.launchConf.readText()).args.first())
    }

    @Test
    fun `refresh for start refuses an unfinished image`() {
        assertFailsWith<LreException.NotFound> { ImageSetup.refreshForStart(layout, host) }
    }
}
