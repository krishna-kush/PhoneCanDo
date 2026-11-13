package com.phonecando.lre.image.reset

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.image.ImageSetup
import com.phonecando.lre.image.support.ConfParser
import com.phonecando.lre.image.support.Distros
import com.phonecando.lre.image.support.Hosts
import com.phonecando.lre.image.support.Tree
import com.phonecando.lre.image.support.TreeUnpacker
import com.phonecando.lre.image.support.treeBase
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ImageResetTest {
    @TempDir
    lateinit var dir: File

    private val layout get() = ImageLayout(File(dir, "files/images/d1"))
    private val host get() = Hosts.local(dir)
    private val debian = treeBase { Distros.debian(it) }

    private class FakeRunner(private val result: (List<String>) -> GuestResult) : GuestRunner {
        val calls = ArrayList<List<String>>()

        override fun run(layout: ImageLayout, argv: List<String>): GuestResult {
            calls += argv
            return result(argv)
        }
    }

    private fun ready() {
        ImageSetup(TreeUnpacker()).create(layout, debian, host, Long.MAX_VALUE)
        // What the user did since: a package, a project, a stray file in the rootfs.
        Tree(layout.rootfs).exe("usr/bin/htop").file("root-junk", "x")
        File(layout.home, "projects/app/main.py").apply { parentFile.mkdirs(); writeText("print(1)") }
    }

    @Test
    fun `reset swaps in a fresh rootfs, keeps home and lists hand-installed packages`() {
        ready()
        // The old system first, then the fresh base, which marks libc6 itself.
        val answers = ArrayDeque(listOf("git\nhtop\nlibc6:arm64\n", "libc6:arm64\n"))
        val runner = FakeRunner { GuestResult(0, answers.removeFirst()) }

        val result = ImageReset(runner, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE)

        assertEquals(listOf(listOf("apt-mark", "showmanual"), listOf("apt-mark", "showmanual")), runner.calls)
        assertFalse(File(layout.rootfs, "usr/bin/htop").exists())
        assertFalse(File(layout.rootfs, "root-junk").exists())
        assertTrue(File(layout.rootfs, "usr/bin/apt-get").isFile)
        assertEquals("debian\n", File(layout.rootfs, "etc/hostname").readText())
        assertEquals("print(1)", File(layout.home, "projects/app/main.py").readText())
        assertFalse(File(layout.root, "rootfs.new").exists())
        assertFalse(File(layout.root, "rootfs.old").exists())
        assertFalse(File(layout.shims, "htop").exists())
        ConfParser.parse(layout.launchConf.readText())

        val expected = ReinstallList("apt-get update && apt-get install -y git htop", listOf("git", "htop"))
        assertEquals(expected, result.reinstall)
        assertEquals(expected, ReinstallList.read(layout))
        assertEquals("debian", result.os.id)
        assertEquals(listOf("rg"), ImageSetup.checkTools(layout, listOf("bash", "git", "rg")).commands)
        assertTrue(ImageSetup.isReady(layout))
    }

    @Test
    fun `a failing package query never stops a reset`() {
        ready()
        val runner = FakeRunner { throw IOException("launcher missing") }
        val result = ImageReset(runner, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE)
        assertNull(result.reinstall)
        assertNull(ReinstallList.read(layout))
        assertFalse(File(layout.rootfs, "root-junk").exists())

        val nonZero = FakeRunner { GuestResult(100, "E: not root\n") }
        assertNull(ImageReset(nonZero, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE).reinstall)
    }

    @Test
    fun `apk reads its world file without running anything`() {
        val alpine = treeBase { Distros.alpine(it) }
        ImageSetup(TreeUnpacker()).create(layout, alpine, host, Long.MAX_VALUE)
        File(layout.rootfs, "etc/apk/world").appendText("git\nnodejs>=22\n")
        val runner = FakeRunner { error("no command expected") }
        val result = ImageReset(runner, TreeUnpacker()).reset(layout, alpine, host, Long.MAX_VALUE)
        assertEquals(emptyList(), runner.calls)
        // The fresh base's own world (alpine-baselayout, busybox, apk-tools) is not offered.
        assertEquals(ReinstallList("apk add git nodejs", listOf("git", "nodejs")), result.reinstall)
        assertEquals(result.reinstall, ReinstallList.read(layout))
    }

    @Test
    fun `nothing is offered when the fresh base marks every package itself`() {
        ready()
        // A baked image installs its tools by hand: they are the base's, not the user's.
        val runner = FakeRunner { GuestResult(0, "bash\ngit\nripgrep\n") }
        val result = ImageReset(runner, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE)
        assertEquals(2, runner.calls.size)
        assertNull(result.reinstall)
        assertNull(ReinstallList.read(layout))
    }

    @Test
    fun `the old list stands when the fresh base cannot be asked`() {
        ready()
        var call = 0
        val runner = FakeRunner { if (call++ == 0) GuestResult(0, "git\nhtop\n") else GuestResult(100, "") }
        val result = ImageReset(runner, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE)
        val expected = ReinstallList("apt-get update && apt-get install -y git htop", listOf("git", "htop"))
        assertEquals(expected, result.reinstall)
        assertEquals(expected, ReinstallList.read(layout))
    }

    @Test
    fun `a failed unpack leaves the old rootfs in place`() {
        ready()
        val broken = treeBase { root ->
            Tree(root).file("partial", "x")
            throw IOException("disk full")
        }
        assertFailsWith<IOException> {
            ImageReset(FakeRunner { GuestResult(0, "") }, TreeUnpacker()).reset(layout, broken, host, Long.MAX_VALUE)
        }
        assertTrue(File(layout.rootfs, "root-junk").exists())
        // The next start throws the half-unpacked rootfs away.
        ImageSetup.refreshForStart(layout, host)
        assertFalse(File(layout.root, "rootfs.new").exists())
        assertTrue(File(layout.rootfs, "root-junk").exists())
    }

    @Test
    fun `a kill mid-swap is finished on the next start`() {
        ready()
        // State after: new rootfs finished, marker written, first rename done, then killed.
        val fresh = File(layout.root, "rootfs.new")
        Distros.alpine(fresh)
        File(layout.run, "reset-swap").writeText(ReinstallList("apk add git", listOf("git")).encode())
        layout.rootfs.renameTo(File(layout.root, "rootfs.old"))

        ImageSetup.refreshForStart(layout, host)

        assertTrue(File(layout.rootfs, "sbin/apk").isFile)
        assertFalse(File(layout.root, "rootfs.old").exists())
        assertFalse(File(layout.run, "reset-swap").exists())
        assertEquals(ReinstallList("apk add git", listOf("git")), ReinstallList.read(layout))
        // Re-detected: the record and run files now describe the alpine rootfs.
        assertTrue(layout.osNote.readText().contains("Alpine Linux"))
        assertEquals(listOf("bash" to "/bin/sh"), ConfParser.parse(layout.launchConf.readText()).maps)
    }

    @Test
    fun `reset needs a ready linux image and room`() {
        assertFailsWith<LreException.NotFound> {
            ImageReset(FakeRunner { GuestResult(0, "") }, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE)
        }
        ImageSetup.android(layout, host)
        assertFailsWith<LreException.NotFound> {
            ImageReset(FakeRunner { GuestResult(0, "") }, TreeUnpacker()).reset(layout, debian, host, Long.MAX_VALUE)
        }
        val other = ImageLayout(File(dir, "files/images/d2"))
        ImageSetup(TreeUnpacker()).create(other, debian, host, Long.MAX_VALUE)
        assertFailsWith<LreException.NoSpace> {
            ImageReset(FakeRunner { GuestResult(0, "") }, TreeUnpacker()).reset(other, debian, host, 10)
        }
    }

    @Test
    fun `reinstall list round-trips and clears`() {
        val list = ReinstallList("pacman -Sy && pacman -S --noconfirm git", listOf("git"))
        assertEquals(list, ReinstallList.decode(list.encode()))
        assertNull(ReinstallList.decode("command x\n"))
    }
}
