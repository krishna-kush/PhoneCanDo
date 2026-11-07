package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class TarNumbersTest {
    private fun parse(bytes: ByteArray) = TarNumbers.parse(bytes, 0, bytes.size, "test")

    private fun ascii(text: String) = text.toByteArray(Charsets.US_ASCII)

    @Test
    fun octal() {
        assertEquals(420L, parse(ascii("0000644\u0000")))
        assertEquals(420L, parse(ascii("   644 \u0000")))
        assertEquals(0L, parse(ByteArray(8)))
        assertEquals(8L shl 30, parse(ascii("100000000000")))
    }

    @Test
    fun `octal rejects junk`() {
        assertFailsWith<LreException.Corrupt> { parse(ascii("0000849\u0000")) }
        assertFailsWith<LreException.Corrupt> { parse(ascii("12\u000034\u0000")) }
    }

    @Test
    fun base256() {
        val positive = ByteArray(12).also {
            it[0] = 0x80.toByte()
            it[7] = 0x02
            it[11] = 0x01
        }
        assertEquals((2L shl 32) + 1, parse(positive))
        val minusOne = ByteArray(12) { 0xff.toByte() }
        assertEquals(-1L, parse(minusOne))
    }

    @Test
    fun `base256 beyond a Long is corrupt`() {
        val huge = ByteArray(12).also {
            it[0] = 0x80.toByte()
            it[3] = 0x01
        }
        assertFailsWith<LreException.Corrupt> { parse(huge) }
    }
}
