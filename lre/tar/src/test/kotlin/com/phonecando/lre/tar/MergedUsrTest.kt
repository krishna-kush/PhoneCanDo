package com.phonecando.lre.tar

import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The layout of a current Debian/Fedora rootfs: /bin, /lib, /sbin are symlinks into /usr. */
class MergedUsrTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    @Test
    fun `merged usr base plus a layer that writes through the bin symlink`() {
        // tar order as debootstrap writes it: the links before usr/ exists.
        guest.extract(
            TarBuilder()
                .dir("./")
                .symlink("./bin", "usr/bin")
                .symlink("./lib", "usr/lib")
                .symlink("./sbin", "usr/sbin")
                .dir("./usr")
                .dir("./usr/bin")
                .file("./usr/bin/bash", "BASH", mode = 0b111_101_101)
                .hardlink("./usr/bin/sh.distrib", "./usr/bin/bash")
                .symlink("./usr/bin/sh", "bash")
                .dir("./usr/lib")
                .file("./usr/lib/libc.so.6", "LIBC")
                .dir("./usr/sbin")
                .build(),
        )
        assertTrue(guest.isSymlink("bin"))
        assertEquals("usr/bin", guest.linkTarget("bin"))
        assertEquals("BASH", guest.text("bin/bash"))
        assertEquals("BASH", guest.text("usr/bin/sh.distrib"))
        assertEquals("LIBC", guest.text("lib/libc.so.6"))

        // A later layer (e.g. an apt install) names paths through the links.
        val stats = guest.extract(
            TarBuilder()
                .file("bin/added", "NEW")
                .hardlink("sbin/added-too", "bin/added")
                .file("lib/.wh.libc.so.6")
                .build(),
        )
        assertTrue(guest.isSymlink("bin"))
        assertEquals("NEW", guest.text("usr/bin/added"))
        assertEquals("NEW", guest.text("usr/sbin/added-too"))
        assertEquals(false, guest.exists("usr/lib/libc.so.6"))
        assertEquals(ExtractStats(1, 0, 0, 1, 1, 0, 6), stats)
        guest.assertOutsideUntouched()
    }

    @Test
    fun `a link that appears before its target dir creates that dir on use`() {
        guest.extract(TarBuilder().symlink("bin", "usr/bin").file("bin/sh", "SH").dir("usr/bin", mode = 0b111_000_000).build())
        assertEquals("SH", guest.text("usr/bin/sh"))
        assertEquals("rwx------", guest.mode("usr/bin"))
    }
}
