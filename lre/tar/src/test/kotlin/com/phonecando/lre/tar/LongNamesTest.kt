package com.phonecando.lre.tar

import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.LongNames
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import kotlin.test.assertEquals

class LongNamesTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    private val longDir = (1..12).joinToString("/") { "directory$it" }
    private val longName = "$longDir/a-file-with-a-name.txt"
    private val longTarget = "/" + (1..15).joinToString("/") { "target$it" }

    @Test
    fun `GNU long names and long links`() {
        guest.extract(
            TarBuilder(LongNames.GNU)
                .file(longName, "gnu")
                .symlink("$longDir/link", longTarget)
                .hardlink("$longDir/copy", longName)
                .build(),
        )
        assertEquals("gnu", guest.text(longName))
        assertEquals(longTarget, guest.linkTarget("$longDir/link"))
        assertEquals("gnu", guest.text("$longDir/copy"))
    }

    @Test
    fun `PAX path and linkpath`() {
        guest.extract(
            TarBuilder(LongNames.PAX)
                .file(longName, "pax")
                .symlink("$longDir/link", longTarget)
                .build(),
        )
        assertEquals("pax", guest.text(longName))
        assertEquals(longTarget, guest.linkTarget("$longDir/link"))
    }

    @Test
    fun `ustar prefix field`() {
        guest.extract(TarBuilder(LongNames.USTAR_PREFIX).file(longName, "ustar").build())
        assertEquals("ustar", guest.text(longName))
    }

    @Test
    fun `PAX size overrides the header size`() {
        guest.extract(
            TarBuilder()
                .pax(mapOf("size" to "11"))
                .header("sized", '0', 0)
                .data("eleven byte".toByteArray())
                .file("after", "ok")
                .build(),
        )
        assertEquals("eleven byte", guest.text("sized"))
        assertEquals("ok", guest.text("after"))
    }

    @Test
    fun `PAX mtime with a fraction, global values and per-entry overrides`() {
        guest.extract(
            TarBuilder()
                .pax(mapOf("mtime" to "1234567890"), global = true)
                .file("global", "g")
                .pax(mapOf("mtime" to "1600000000.75", "path" to "renamed"))
                .file("original", "x")
                .file("global-again", "g")
                .build(),
        )
        assertEquals(1_234_567_890_000L, mtimeMillis("global"))
        assertEquals(1_600_000_000_750L, mtimeMillis("renamed"))
        assertEquals(1_234_567_890_000L, mtimeMillis("global-again"))
        assertEquals(setOf("global", "renamed", "global-again"), guest.tree())
    }

    @Test
    fun `PAX records may hold UTF-8 names`() {
        guest.extract(TarBuilder().pax(mapOf("path" to "über/ñame")).file("x", "u").build())
        assertEquals("u", guest.text("über/ñame"))
    }

    private fun mtimeMillis(rel: String) = Files.getLastModifiedTime(guest.path(rel), LinkOption.NOFOLLOW_LINKS).toMillis()
}
