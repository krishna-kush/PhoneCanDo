package com.phonecando.lre.tar.layer

import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.fs.Modes
import org.junit.jupiter.api.Test
import java.nio.file.attribute.PosixFilePermissions
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

/** The pure rules: whiteout names, this layer's paths, mode bits. */
class LayerRulesTest {
    private fun parse(path: String) = Whiteout.parse(path.split('/'), path)

    @Test
    fun `whiteout names`() {
        assertNull(parse("etc/passwd"))
        assertNull(parse("etc/.whiteout"))
        assertSame(Whiteout.Opaque, parse("etc/.wh..wh..opq"))
        assertEquals("passwd", assertIs<Whiteout.Remove>(parse("etc/.wh.passwd")).name)
        assertSame(Whiteout.Ignored, parse(".wh..wh.plnk"))
        assertSame(Whiteout.Ignored, parse(".wh..wh.plnk/42.1"))
        assertSame(Whiteout.Ignored, parse("a/.wh..wh.aufs"))
        for (bad in listOf("a/.wh.", "a/.wh..", "a/.wh...")) {
            assertFailsWith<LreException.UnsafeEntry>(bad) { parse(bad) }
        }
    }

    @Test
    fun `layer paths know written paths and their ancestors`() {
        val paths = LayerPaths()
        paths.add("a/b/c")
        paths.add("a/b/d")
        paths.add("x")
        for (key in listOf("a", "a/b", "a/b/c", "a/b/d", "x")) assertTrue(paths.touched(key), key)
        for (key in listOf("a/b/e", "a/bc", "b", "x/y", "")) assertFalse(paths.touched(key), key)
    }

    @Test
    fun modes() {
        fun file(mode: Int) = PosixFilePermissions.toString(Modes.file(mode))
        fun dir(mode: Int) = PosixFilePermissions.toString(Modes.dir(mode))
        assertEquals("rwxr-xr-x", file(0b100_111_101_101))
        assertEquals("rw-------", file(0))
        assertEquals("rwxrw-rw-", file(0b101_110_110))
        assertEquals("rwx------", dir(0))
        assertEquals("rwxrwxrwx", dir(0b001_111_111_111))
        assertEquals("rwxr-xr-x", PosixFilePermissions.toString(Modes.toPermissions(Modes.IMPLICIT_DIR)))
    }
}
