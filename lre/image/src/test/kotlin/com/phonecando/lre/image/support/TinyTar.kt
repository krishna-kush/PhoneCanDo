package com.phonecando.lre.image.support

import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.Compression
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.zip.GZIPOutputStream

/** Writes small ustar archives (dirs, files, symlinks) for end-to-end tests. */
class TinyTar {
    private val out = ByteArrayOutputStream()

    fun dir(name: String) = apply { entry(name.trimEnd('/') + "/", '5', "755", ByteArray(0), "") }

    fun file(name: String, text: String, mode: String = "644") = apply { entry(name, '0', mode, text.toByteArray(), "") }

    fun exe(name: String) = file(name, "#!/bin/sh\n", "755")

    fun link(name: String, target: String) = apply { entry(name, '2', "777", ByteArray(0), target) }

    /** The archive, gzip-compressed. */
    fun gzip(): ByteArray {
        val raw = ByteArrayOutputStream().also { it.write(out.toByteArray()); it.write(ByteArray(1024)) }.toByteArray()
        return ByteArrayOutputStream().also { bytes -> GZIPOutputStream(bytes).use { it.write(raw) } }.toByteArray()
    }

    private fun entry(name: String, type: Char, mode: String, data: ByteArray, link: String) {
        val header = ByteArray(512)
        put(header, 0, name, 100)
        put(header, 100, mode.padStart(7, '0'), 8)
        put(header, 108, "0000000", 8)
        put(header, 116, "0000000", 8)
        put(header, 124, data.size.toString(8).padStart(11, '0'), 12)
        put(header, 136, "14000000000", 12)
        header[156] = type.code.toByte()
        put(header, 157, link, 100)
        put(header, 257, "ustar", 6)
        put(header, 263, "00", 2)
        for (i in 148 until 156) header[i] = ' '.code.toByte()
        val sum = header.sumOf { it.toInt() and 0xff }
        put(header, 148, sum.toString(8).padStart(6, '0'), 7)
        out.write(header)
        out.write(data)
        val pad = (512 - data.size % 512) % 512
        out.write(ByteArray(pad))
    }

    private fun put(header: ByteArray, at: Int, value: String, width: Int) {
        val bytes = value.toByteArray()
        require(bytes.size <= width) { "$value does not fit $width bytes" }
        bytes.copyInto(header, at)
    }
}

/** A gzip layer held in memory. */
class BytesLayer(private val bytes: ByteArray) : BaseLayer {
    override val compression = Compression.GZIP
    override val size: Long get() = bytes.size.toLong()

    override fun open(): InputStream = ByteArrayInputStream(bytes)
}
