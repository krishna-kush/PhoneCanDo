package com.phonecando.lre.tar

import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import kotlin.test.assertEquals

class ModesTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    @Test
    fun `setuid, setgid and sticky are dropped, the rest kept`() {
        guest.extract(
            TarBuilder()
                .file("suid", "x", mode = 0b100_111_101_101)
                .file("sgid", "x", mode = 0b010_111_101_101)
                .dir("tmp", mode = 0b001_111_111_111)
                .file("plain", "x", mode = 0b110_100_000)
                .build(),
        )
        assertEquals("rwxr-xr-x", guest.mode("suid"))
        assertEquals("rwxr-xr-x", guest.mode("sgid"))
        assertEquals("rwxrwxrwx", guest.mode("tmp"))
        assertEquals("rw-r-----", guest.mode("plain"))
    }

    @Test
    fun `owner read-write is forced on files and rwx on dirs`() {
        guest.extract(
            TarBuilder()
                .file("readonly", "x", mode = 0b100_100_100)
                .file("none", "x", mode = 0)
                .file("exec-only", "x", mode = 0b001_001_001)
                .dir("locked", mode = 0)
                .build(),
        )
        assertEquals("rw-r--r--", guest.mode("readonly"))
        assertEquals("rw-------", guest.mode("none"))
        assertEquals("rwx--x--x", guest.mode("exec-only"))
        assertEquals("rwx------", guest.mode("locked"))
    }

    @Test
    fun `a read-only dir in the archive still takes later entries`() {
        guest.extract(
            TarBuilder()
                .dir("ro", mode = 0b101_101_101, mtime = 1_000)
                .file("ro/inner", "x")
                .dir("ro/sub", mode = 0b101_000_000)
                .file("ro/sub/deeper", "y")
                .build(),
        )
        assertEquals("x", guest.text("ro/inner"))
        assertEquals("y", guest.text("ro/sub/deeper"))
        assertEquals("rwxr-xr-x", guest.mode("ro"))
        // Set after its children landed.
        assertEquals(1_000_000L, Files.getLastModifiedTime(guest.path("ro"), LinkOption.NOFOLLOW_LINKS).toMillis())
        // A later layer can still change and remove what is inside.
        guest.extract(TarBuilder().file("ro/.wh.inner").file("ro/sub/deeper", "z").build())
        assertEquals(setOf("ro", "ro/sub", "ro/sub/deeper"), guest.tree())
    }

    @Test
    fun `implicit parent dirs are 0755`() {
        guest.extract(TarBuilder().file("a/b/c", "x").build())
        assertEquals("rwxr-xr-x", guest.mode("a"))
        assertEquals("rwxr-xr-x", guest.mode("a/b"))
    }
}
