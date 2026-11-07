package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException
import java.math.BigInteger

/** Numeric header fields: octal ASCII, or GNU base-256 when the first byte's high bit is set. */
internal object TarNumbers {
    fun parse(block: ByteArray, offset: Int, length: Int, field: String): Long {
        val first = block[offset].toInt() and 0xff
        return if (first and 0x80 != 0) {
            parseBase256(block, offset, length, field)
        } else {
            parseOctal(block, offset, length, field)
        }
    }

    /** Big-endian two's complement; the marker bit doubles as the sign of negative values. */
    private fun parseBase256(block: ByteArray, offset: Int, length: Int, field: String): Long {
        val bytes = block.copyOfRange(offset, offset + length)
        val value = if (bytes[0].toInt() and 0x40 != 0) {
            BigInteger(bytes)
        } else {
            bytes[0] = (bytes[0].toInt() and 0x7f).toByte()
            BigInteger(1, bytes)
        }
        if (value.bitLength() > 63) throw LreException.Corrupt("tar $field field")
        return value.toLong()
    }

    /** Octal digits, padded with spaces or NULs on either side (writers differ). */
    private fun parseOctal(block: ByteArray, offset: Int, length: Int, field: String): Long {
        var start = offset
        var end = offset + length
        while (start < end && isPad(block[start])) start++
        while (end > start && isPad(block[end - 1])) end--
        var value = 0L
        for (i in start until end) {
            val digit = block[i] - '0'.code.toByte()
            if (digit !in 0..7 || value > Long.MAX_VALUE shr 3) throw LreException.Corrupt("tar $field field")
            value = (value shl 3) or digit.toLong()
        }
        return value
    }

    private fun isPad(b: Byte) = b == SPACE || b == NUL

    private const val SPACE = ' '.code.toByte()
    private const val NUL = 0.toByte()
}
