package com.phonecando.lre.tar

import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EntryTypesTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    @Test
    fun `regular files, dirs and symlinks land with their content`() {
        val stats = guest.extract(
            TarBuilder()
                .dir("etc")
                .file("etc/hostname", "phone\n")
                .file("empty")
                .symlink("etc/localtime", "/usr/share/zoneinfo/UTC")
                .symlink("rel", "etc/hostname")
                .build(),
        )
        assertEquals("phone\n", guest.text("etc/hostname"))
        assertEquals(0L, Files.size(guest.path("empty")))
        assertTrue(guest.isDir("etc"))
        assertEquals(ExtractStats(files = 2, dirs = 1, symlinks = 2, hardlinksCopied = 0, whiteouts = 0, skipped = 0, bytes = 6), stats)
    }

    @Test
    fun `symlink targets are kept verbatim, absolute ones as guest paths`() {
        guest.extract(
            TarBuilder()
                .symlink("lib/ld.so", "/lib/ld-musl-aarch64.so.1")
                .symlink("dangling", "../nowhere/at/all")
                .build(),
        )
        assertEquals("/lib/ld-musl-aarch64.so.1", guest.linkTarget("lib/ld.so"))
        assertEquals("../nowhere/at/all", guest.linkTarget("dangling"))
        guest.assertOutsideUntouched()
    }

    @Test
    fun `hard links become independent copies of their target`() {
        val stats = guest.extract(
            TarBuilder()
                .file("usr/bin/busybox", "BB", mode = 0b111_101_101)
                .hardlink("bin/sh", "usr/bin/busybox")
                .hardlink("./bin/ash", "./usr//bin/busybox")
                .build(),
        )
        assertEquals("BB", guest.text("bin/sh"))
        assertEquals("BB", guest.text("bin/ash"))
        assertEquals("rwxr-xr-x", guest.mode("bin/sh"))
        assertFalse(Files.isSameFile(guest.path("bin/sh"), guest.path("usr/bin/busybox")))
        assertEquals(1, Files.getAttribute(guest.path("usr/bin/busybox"), "unix:nlink"))
        assertEquals(2, stats.hardlinksCopied)
        assertEquals(6L, stats.bytes)
    }

    @Test
    fun `a hard link to a symlink copies the symlink`() {
        guest.extract(TarBuilder().symlink("a", "/etc/target").hardlink("b", "a").build())
        assertEquals("/etc/target", guest.linkTarget("b"))
    }

    @Test
    fun `a hard link to a missing target is corrupt`() {
        assertFailsWith<LreException.Corrupt> { guest.extract(TarBuilder().hardlink("b", "nope").build()) }
    }

    @Test
    fun `a hard link to a directory is refused`() {
        assertFailsWith<LreException.UnsafeEntry> { guest.extract(TarBuilder().dir("d").hardlink("b", "d").build()) }
    }

    @Test
    fun `device nodes and fifos are skipped and counted`() {
        val stats = guest.extract(
            TarBuilder()
                .dir("dev")
                .special("dev/null", '3')
                .special("dev/sda", '4')
                .special("run/fifo", '6')
                .build(),
        )
        assertEquals(setOf("dev"), guest.tree())
        assertEquals(3, stats.skipped)
    }

    @Test
    fun `unknown member types are skipped with their data`() {
        val stats = guest.extract(
            TarBuilder()
                .header("label", 'V', 3)
                .data("abc".toByteArray())
                .file("after", "ok")
                .build(),
        )
        assertEquals("ok", guest.text("after"))
        assertEquals(1, stats.skipped)
    }

    @Test
    fun `sparse members are unsupported`() {
        assertFailsWith<LreException.UnsupportedLayer> {
            guest.extract(TarBuilder().header("sparse", 'S', 0).build())
        }
    }

    @Test
    fun `names are normalised`() {
        guest.extract(
            TarBuilder()
                .dir("./")
                .file("./a//b/./c", "x")
                .file("a/b/../d", "y")
                .build(),
        )
        assertEquals(setOf("a", "a/b", "a/b/c", "a/d"), guest.tree())
    }

    @Test
    fun `the root entry counts as a dir and changes nothing`() {
        val stats = guest.extract(TarBuilder().dir("./", mode = 0).build())
        assertEquals(1, stats.dirs)
        assertTrue(Files.isWritable(guest.dest))
    }

    @Test
    fun `a v7 regular member with a trailing slash is a dir`() {
        guest.extract(TarBuilder().header("olddir/", '0', 0).file("olddir/f", "z").build())
        assertTrue(guest.isDir("olddir"))
        assertEquals("z", guest.text("olddir/f"))
    }

    @Test
    fun `header-only types ignore a nonzero size field`() {
        guest.extract(TarBuilder().header("d", '5', 1024).file("after", "ok").build())
        assertTrue(guest.isDir("d"))
        assertEquals("ok", guest.text("after"))
    }

    @Test
    fun `base-256 size fields are read`() {
        guest.extract(
            TarBuilder()
                .header("big", '0', 5, base256Size = true)
                .data("12345".toByteArray())
                .build(),
        )
        assertEquals("12345", guest.text("big"))
    }

    @Test
    fun `mtimes are set on files and dirs`() {
        guest.extract(TarBuilder().dir("d", mtime = 1_000_000).file("d/f", "x", mtime = 2_000_000).build())
        assertEquals(1_000_000_000L, Files.getLastModifiedTime(guest.path("d"), LinkOption.NOFOLLOW_LINKS).toMillis())
        assertEquals(2_000_000_000L, Files.getLastModifiedTime(guest.path("d/f")).toMillis())
    }

    @Test
    fun `an archive without an end marker ends cleanly at a member boundary`() {
        guest.extract(TarBuilder().file("a", "x").build(endMarker = false))
        assertEquals("x", guest.text("a"))
    }

    @Test
    fun `a bad header checksum is corrupt`() {
        assertFailsWith<LreException.Corrupt> {
            guest.extract(TarBuilder().header("a", '0', 0, corruptChecksum = true).build())
        }
    }
}
