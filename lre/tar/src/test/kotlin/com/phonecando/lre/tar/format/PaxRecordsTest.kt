package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.support.TarBuilder
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class PaxRecordsTest {
    @Test
    fun `records, later keys win, values may hold spaces, equals and UTF-8`() {
        val bytes = TarBuilder.paxRecord("path", "a b=c") +
            TarBuilder.paxRecord("linkpath", "ünï") +
            TarBuilder.paxRecord("path", "final") +
            TarBuilder.paxRecord("empty", "")
        assertEquals(mapOf("path" to "final", "linkpath" to "ünï", "empty" to ""), PaxRecords.parse(bytes))
    }

    @Test
    fun `malformed records are corrupt`() {
        for (bad in listOf("5 a=b\n", "99 path=x\n", "x path=x\n", "11 pathxyz\n", "11 path=xy ")) {
            assertFailsWith<LreException.Corrupt>(bad) { PaxRecords.parse(bad.toByteArray()) }
        }
    }

    @Test
    fun `global records merge and empty values delete`() {
        val globals = mutableMapOf("mtime" to "1", "path" to "p")
        PaxRecords.applyGlobal(globals, mapOf("mtime" to "2", "path" to ""))
        assertEquals(mapOf("mtime" to "2"), globals)
    }

    @Test
    fun times() {
        assertEquals(Instant.ofEpochSecond(1_600_000_000, 500_000_000), PaxRecords.parseTime("1600000000.5")?.toInstant())
        assertEquals(Instant.ofEpochSecond(-1, -500_000_000), PaxRecords.parseTime("-1.5")?.toInstant())
        assertEquals(Instant.ofEpochSecond(-1, 500_000_000), PaxRecords.parseTime("-0.5")?.toInstant())
        assertEquals(Instant.ofEpochSecond(42), PaxRecords.parseTime("42")?.toInstant())
        assertNull(PaxRecords.parseTime("soon"))
    }

    @Test
    fun sizes() {
        assertEquals(9_000_000_000L, PaxRecords.parseSize("9000000000"))
        assertFailsWith<LreException.Corrupt> { PaxRecords.parseSize("-1") }
        assertFailsWith<LreException.Corrupt> { PaxRecords.parseSize("99999999999999999999") }
    }
}
