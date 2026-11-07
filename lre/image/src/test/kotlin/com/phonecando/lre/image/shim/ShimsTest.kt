package com.phonecando.lre.image.shim

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.PayloadNames
import com.phonecando.lre.image.guest.GuestPath
import com.phonecando.lre.image.support.Distros
import com.phonecando.lre.image.support.Hosts
import com.phonecando.lre.image.support.Tree
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ShimsTest {
    @TempDir
    lateinit var dir: File

    private val layout get() = ImageLayout(File(dir, "img"))
    private val host get() = Hosts.local(dir)
    private val target = Paths.get(Hosts.LIB, PayloadNames.LAUNCHER)

    private fun names() = layout.shims.list()!!.toSortedSet()

    @Test
    fun `debian commands get shims through merged usr links`() {
        Distros.debian(layout.rootfs)
        val stats = Shims().refresh(layout, host, GuestPath.DEFAULT)
        assertEquals(sortedSetOf("apt-get", "apt-mark", "bash", "dash", "git", "ls", "sh"), names())
        assertEquals(7, stats.added)
        layout.shims.listFiles()!!.forEach { assertEquals(target, Files.readSymbolicLink(it.toPath())) }
    }

    @Test
    fun `busybox applet links count, broken and unsafe names do not`() {
        Distros.alpine(layout.rootfs)
        Tree(layout.rootfs)
            .link("usr/bin/dangling", "/nowhere")
            .file("usr/bin/notes.txt", "x")
            .exe("usr/bin/.hidden")
            .exe("usr/bin/libfake.so")
            .exe("usr/bin/with space")
            .link("usr/bin/loop", "loop")
        Shims().refresh(layout, host, GuestPath.DEFAULT)
        assertEquals(sortedSetOf("apk", "ash", "bash", "busybox", "env", "ls", "sh"), names())
    }

    @Test
    fun `refresh adds new, removes stale, keeps correct and repoints moved links`() {
        Distros.debian(layout.rootfs)
        Shims().refresh(layout, host, GuestPath.DEFAULT)
        val gitLink = File(layout.shims, "git").toPath()
        val before = Files.readAttributes(gitLink, java.nio.file.attribute.BasicFileAttributes::class.java, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey()

        Files.delete(File(layout.rootfs, "usr/bin/ls").toPath())
        Tree(layout.rootfs).exe("usr/bin/rg")
        Files.delete(File(layout.shims, "dash").toPath())
        Files.createSymbolicLink(File(layout.shims, "dash").toPath(), Paths.get("/old/lib/libphonecando_launch.so"))
        Files.createSymbolicLink(File(layout.shims, "stale").toPath(), target)

        val stats = Shims().refresh(layout, host, GuestPath.DEFAULT)
        assertEquals(sortedSetOf("apt-get", "apt-mark", "bash", "dash", "git", "rg", "sh"), names())
        assertEquals(ShimStats(added = 2, removed = 3, kept = 5), stats)
        assertEquals(target, Files.readSymbolicLink(File(layout.shims, "dash").toPath()))
        val after = Files.readAttributes(gitLink, java.nio.file.attribute.BasicFileAttributes::class.java, java.nio.file.LinkOption.NOFOLLOW_LINKS).fileKey()
        assertEquals(before, after)

        assertEquals(ShimStats(0, 0, 7), Shims().refresh(layout, host, GuestPath.DEFAULT))
    }

    @Test
    fun `a new lib dir repoints every shim`() {
        Distros.debian(layout.rootfs)
        Shims().refresh(layout, host, GuestPath.DEFAULT)
        val moved = Hosts.local(dir, libDir = "/data/app/~~new==/lib/arm64")
        val stats = Shims().refresh(layout, moved, GuestPath.DEFAULT)
        assertEquals(7, stats.added)
        assertEquals(7, stats.removed)
        assertEquals(
            Paths.get("/data/app/~~new==/lib/arm64", PayloadNames.LAUNCHER),
            Files.readSymbolicLink(File(layout.shims, "git").toPath()),
        )
    }

    @Test
    fun `bash and sh are always there, even with an empty rootfs`() {
        layout.rootfs.mkdirs()
        Shims().refresh(layout, host, GuestPath.DEFAULT)
        assertEquals(sortedSetOf("bash", "sh"), names())
    }

    @Test
    fun `two thousand executables refresh fast`() {
        val tree = Tree(layout.rootfs).link("bin", "usr/bin")
        repeat(1500) { tree.exe("usr/bin/tool$it") }
        tree.exe("usr/bin/busybox")
        repeat(500) { tree.link("usr/bin/applet$it", "/bin/busybox") }

        val start = System.nanoTime()
        val first = Shims().refresh(layout, host, GuestPath.DEFAULT)
        val firstMs = (System.nanoTime() - start) / 1_000_000
        assertEquals(2003, first.added)

        val again = System.nanoTime()
        val second = Shims().refresh(layout, host, GuestPath.DEFAULT)
        val secondMs = (System.nanoTime() - again) / 1_000_000
        assertEquals(ShimStats(0, 0, 2003), second)
        assertTrue(firstMs < 5_000, "first refresh took $firstMs ms")
        assertTrue(secondMs < 2_000, "no-op refresh took $secondMs ms")
    }

    @Test
    fun `safe names`() {
        assertTrue(ShimNames.isSafe("git"))
        assertTrue(ShimNames.isSafe("["))
        assertTrue(ShimNames.isSafe("x86_64-linux-gnu-gcc-14"))
        assertTrue(ShimNames.isSafe("libtool"))
        assertTrue(ShimNames.isSafe("li.so"))
        assertFalse(ShimNames.isSafe("lib.so"))
        assertFalse(ShimNames.isSafe(""))
        assertFalse(ShimNames.isSafe(".."))
        assertFalse(ShimNames.isSafe("a b"))
        assertFalse(ShimNames.isSafe("a\nb"))
        assertFalse(ShimNames.isSafe("libphonecando_launch.so"))
        assertFalse(ShimNames.isSafe("x".repeat(256)))
    }
}
