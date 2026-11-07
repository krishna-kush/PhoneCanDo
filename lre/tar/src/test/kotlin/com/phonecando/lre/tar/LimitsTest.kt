package com.phonecando.lre.tar

import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class LimitsTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    private fun tooLarge(archive: TarBuilder, limits: TarLimits): LreException.TooLarge =
        assertFailsWith<LreException.TooLarge> { guest.extract(archive.build(), limits = limits) }

    @Test
    fun `too many entries`() {
        val e = tooLarge(TarBuilder().dir("a").dir("b").special("c", '6'), TarLimits(maxEntries = 2))
        assertEquals(2L, e.limit)
    }

    @Test
    fun `a file over the per-file cap`() {
        tooLarge(TarBuilder().file("f", ByteArray(11)), TarLimits(maxFileBytes = 10))
    }

    @Test
    fun `files over the total cap, hard-link copies included`() {
        tooLarge(TarBuilder().file("a", ByteArray(10)).file("b", ByteArray(10)), TarLimits(maxTotalBytes = 15))
        tooLarge(TarBuilder().file("c", ByteArray(10)).hardlink("d", "c"), TarLimits(maxTotalBytes = 15))
    }

    @Test
    fun `exactly at the caps is fine`() {
        val stats = guest.extract(
            TarBuilder().file("a", ByteArray(10)).file("b", ByteArray(5)).build(),
            limits = TarLimits(maxEntries = 2, maxTotalBytes = 15, maxFileBytes = 10),
        )
        assertEquals(15L, stats.bytes)
    }

    @Test
    fun `paths and link targets over the path cap`() {
        val limits = TarLimits(maxPathBytes = 50)
        tooLarge(TarBuilder().file("x".repeat(51), "x"), limits)
        tooLarge(TarBuilder().symlink("s", "y".repeat(51)), limits)
        tooLarge(TarBuilder().pax(mapOf("path" to "z".repeat(51))).file("p", "x"), limits)
    }

    @Test
    fun `a GNU long name bigger than any path is refused before it is read`() {
        tooLarge(
            TarBuilder().header("././@LongLink", 'L', 1L shl 40).data(ByteArray(512)),
            TarLimits(),
        )
    }

    @Test
    fun `a huge PAX header is refused before it is read`() {
        tooLarge(TarBuilder().header("PaxHeaders/x", 'x', 1L shl 30), TarLimits())
    }
}
