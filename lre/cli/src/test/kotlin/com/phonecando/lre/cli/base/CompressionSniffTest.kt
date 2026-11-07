package com.phonecando.lre.cli.base

import com.phonecando.lre.api.Compression
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.util.zip.GZIPOutputStream
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CompressionSniffTest {
    @TempDir
    lateinit var dir: File

    private fun bytes(vararg values: Int) = ByteArray(values.size) { values[it].toByte() }

    @Test
    fun `magic numbers decide`() {
        assertEquals(Compression.GZIP, CompressionSniff.of(bytes(0x1f, 0x8b, 0x08, 0, 0, 0)))
        assertEquals(Compression.XZ, CompressionSniff.of(bytes(0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00)))
        assertEquals(Compression.ZSTD, CompressionSniff.of(bytes(0x28, 0xb5, 0x2f, 0xfd, 0, 0)))
        assertEquals(Compression.NONE, CompressionSniff.of("bin/\u0000\u0000".toByteArray()))
        assertEquals(Compression.NONE, CompressionSniff.of(bytes(0x1f)))
        assertEquals(Compression.NONE, CompressionSniff.of(ByteArray(0)))
    }

    @Test
    fun `a tarball is one layer with no config, whatever its name`() {
        val file = File(dir, "rootfs.tar.xz") // gzip inside: the bytes win
        GZIPOutputStream(file.outputStream()).use { it.write(ByteArray(1024)) }
        val fetched = TarballBase.of(file)
        val layer = fetched.base.layers.single()
        assertEquals(Compression.GZIP, layer.compression)
        assertEquals(file.length(), layer.size)
        assertEquals(null, fetched.base.config)
        assertEquals(SourceInfo.Tarball(file.path, file.length()), fetched.info)
        assertEquals(0x1f, layer.open().use { it.read() })
    }

    @Test
    fun `a missing tarball is not_found`() {
        assertFailsWith<com.phonecando.lre.api.LreException.NotFound> { TarballBase.of(File(dir, "nope.tar")) }
    }
}
