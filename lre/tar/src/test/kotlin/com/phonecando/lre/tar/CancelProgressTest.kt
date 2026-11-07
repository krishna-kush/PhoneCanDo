package com.phonecando.lre.tar

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.Progress
import com.phonecando.lre.tar.support.Compress
import com.phonecando.lre.tar.support.Guest
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.random.Random
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class CancelProgressTest {
    @TempDir
    lateinit var tmp: Path

    private val guest by lazy { Guest(tmp) }

    private val archive = TarBuilder().apply {
        repeat(20) { file("f$it", Random(it).nextBytes(300_000)) }
    }.build()

    @Test
    fun `cancel between entries`() {
        var checks = 0
        assertFailsWith<LreException.Cancelled> {
            guest.extract(archive, cancel = CancelSignal { ++checks > 3 })
        }
        assertTrue(guest.tree().size < 20)
    }

    @Test
    fun `cancel inside a large file`() {
        val big = TarBuilder().file("big", ByteArray(8 shl 20)).build()
        var checks = 0
        assertFailsWith<LreException.Cancelled> {
            // The first check comes before the first member: cancel only once data flows.
            guest.extract(big, cancel = CancelSignal { ++checks > 2 })
        }
    }

    @Test
    fun `progress reports compressed bytes read, step unpack, ending at the full size`() {
        val gz = Compress.gzip(archive)
        val reports = ArrayList<Progress>()
        guest.extract(gz, Compression.GZIP, sink = { reports += it })
        assertTrue(reports.size > 3)
        assertTrue(reports.all { it.step == "unpack" && it.total == null })
        assertEquals(reports.map { it.done }.sorted(), reports.map { it.done })
        assertEquals(gz.size.toLong(), reports.last().done)
    }
}
