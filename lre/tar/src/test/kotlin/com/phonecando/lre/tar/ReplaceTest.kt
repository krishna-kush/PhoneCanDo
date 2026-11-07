package com.phonecando.lre.tar

import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** An entry replaces what lower layers (or earlier members) left at its path unless both are dirs. */
class ReplaceTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    @Test
    fun `a dir replaces a file`() {
        guest.extract(TarBuilder().file("p", "file").build())
        guest.extract(TarBuilder().dir("p").file("p/x", "x").build())
        assertTrue(guest.isDir("p"))
        assertEquals("x", guest.text("p/x"))
    }

    @Test
    fun `a file replaces a whole dir tree`() {
        guest.extract(TarBuilder().file("q/inner/deep", "d").build())
        guest.extract(TarBuilder().file("q", "file").build())
        assertEquals("file", guest.text("q"))
    }

    @Test
    fun `a dir replaces a symlink to a dir`() {
        guest.extract(TarBuilder().file("target/t", "t").symlink("r", "target").build())
        guest.extract(TarBuilder().dir("r").build())
        assertTrue(guest.isDir("r"))
        assertEquals(setOf("target", "target/t", "r"), guest.tree())
    }

    @Test
    fun `a symlink replaces a dir tree`() {
        guest.extract(TarBuilder().file("s/inner", "i").build())
        guest.extract(TarBuilder().symlink("s", "elsewhere").build())
        assertTrue(guest.isSymlink("s"))
        assertEquals(setOf("s"), guest.tree())
    }

    @Test
    fun `a dir over a dir merges and keeps lower content`() {
        guest.extract(TarBuilder().file("m/lower", "l").build())
        guest.extract(TarBuilder().dir("m").file("m/upper", "u").build())
        assertEquals(setOf("m", "m/lower", "m/upper"), guest.tree())
    }

    @Test
    fun `a file overwrites a file`() {
        guest.extract(TarBuilder().file("f", "a much longer old content").build())
        guest.extract(TarBuilder().file("f", "new").build())
        assertEquals("new", guest.text("f"))
    }

    @Test
    fun `a file replaces a symlink without touching its target`() {
        guest.extract(TarBuilder().file("real", "real").symlink("alias", "real").build())
        guest.extract(TarBuilder().file("alias", "own").build())
        assertFalse(guest.isSymlink("alias"))
        assertEquals("own", guest.text("alias"))
        assertEquals("real", guest.text("real"))
    }

    @Test
    fun `replacement within one layer`() {
        guest.extract(TarBuilder().file("t", "file").dir("t").file("t/x", "x").symlink("u", "t").file("u", "file").build())
        assertTrue(guest.isDir("t"))
        assertEquals("file", guest.text("u"))
    }

    @Test
    fun `a member below a file replaces the file with a dir`() {
        guest.extract(TarBuilder().file("n", "file").build())
        guest.extract(TarBuilder().file("n/child", "c").build())
        assertEquals("c", guest.text("n/child"))
        assertEquals("rwxr-xr-x", guest.mode("n"))
    }
}
