package com.phonecando.lre.tar.support

import org.tukaani.xz.LZMA2Options
import org.tukaani.xz.XZOutputStream
import java.io.ByteArrayOutputStream
import java.util.zip.GZIPOutputStream

/** Compressed forms of test archives. */
object Compress {
    fun gzip(bytes: ByteArray): ByteArray =
        ByteArrayOutputStream().also { out -> GZIPOutputStream(out).use { it.write(bytes) } }.toByteArray()

    /** One gzip member per part, concatenated (what pigz --independent or bgzip write). */
    fun gzipMembers(bytes: ByteArray, vararg cuts: Int): ByteArray {
        val out = ByteArrayOutputStream()
        val bounds = listOf(0) + cuts.toList() + bytes.size
        for (i in 0 until bounds.size - 1) out.write(gzip(bytes.copyOfRange(bounds[i], bounds[i + 1])))
        return out.toByteArray()
    }

    fun xz(bytes: ByteArray): ByteArray =
        ByteArrayOutputStream().also { out -> XZOutputStream(out, LZMA2Options(3)).use { it.write(bytes) } }.toByteArray()
}
