package com.phonecando.lre.cli.base

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream

/**
 * A local rootfs tarball as a base with one layer and no image config, the
 * way the app sets up the baked Default image.
 */
object TarballBase {
    /** @throws LreException.NotFound when [file] is not a readable file. */
    fun of(file: File): FetchedBase {
        if (!file.isFile || !file.canRead()) throw LreException.NotFound("tarball $file")
        val head = file.inputStream().use { it.readNBytes(CompressionSniff.HEAD_BYTES) }
        val layer = FileBaseLayer(file, CompressionSniff.of(head))
        return FetchedBase(BaseImage(listOf(layer), null), SourceInfo.Tarball(file.path, file.length()))
    }
}

/** One layer read from a file on disk. */
private class FileBaseLayer(private val file: File, override val compression: Compression) : BaseLayer {
    override val size: Long get() = file.length()

    override fun open(): InputStream = BufferedInputStream(file.inputStream(), 64 * 1024)
}
