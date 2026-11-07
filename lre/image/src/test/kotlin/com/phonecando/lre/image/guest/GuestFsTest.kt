package com.phonecando.lre.image.guest

import com.phonecando.lre.image.support.Tree
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GuestFsTest {
    @TempDir
    lateinit var dir: File

    @Test
    fun `merged usr links resolve guest-relative`() {
        val root = File(dir, "rootfs")
        Tree(root).link("bin", "usr/bin").exe("usr/bin/bash").link("usr/bin/sh", "bash")
        val fs = GuestFs(root)
        assertEquals(File(root, "usr/bin/bash").toPath(), fs.resolve("/bin/sh"))
        assertEquals("/usr/bin", fs.canonical("/bin"))
        assertTrue(fs.isExecutable("/bin/sh"))
        assertEquals("/bin/bash", fs.findCommand("bash", listOf("/bin", "/usr/bin")))
    }

    @Test
    fun `an absolute link restarts at the rootfs, never on the host`() {
        val root = File(dir, "rootfs")
        val outside = File(dir, "host-secret").apply { writeText("host") }
        Tree(root).link("etc/passwd", outside.path).file(outside.path, "guest")
        val resolved = GuestFs(root).resolve("/etc/passwd")!!
        assertTrue(resolved.startsWith(root.toPath()))
        assertEquals("guest", resolved.toFile().readText())
    }

    @Test
    fun `dot-dot stops at the rootfs`() {
        val root = File(dir, "rootfs")
        Tree(root).link("etc/escape", "../../../../../../tmp").dir("tmp")
        assertEquals(File(root, "tmp").toPath(), GuestFs(root).resolve("/etc/escape"))
    }

    @Test
    fun `a link loop gives up instead of spinning`() {
        val root = File(dir, "rootfs")
        Tree(root).link("a", "b").link("b", "/a")
        val fs = GuestFs(root)
        assertNull(fs.resolve("/a"))
        assertFalse(fs.isExecutable("/a"))
    }

    @Test
    fun `resolveName keeps the last component as named`() {
        val root = File(dir, "rootfs")
        Tree(root).link("etc", "private/etc").link("private/etc/resolv.conf", "/run/stub")
        assertEquals(File(root, "private/etc/resolv.conf").toPath(), GuestFs(root).resolveName("/etc/resolv.conf"))
    }

    @Test
    fun `a non-executable file is not a command`() {
        val root = File(dir, "rootfs")
        Tree(root).file("usr/bin/readme", "x")
        assertNull(GuestFs(root).findCommand("readme", listOf("/usr/bin")))
    }
}
