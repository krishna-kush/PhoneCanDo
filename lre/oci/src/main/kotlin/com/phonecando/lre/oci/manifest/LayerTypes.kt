package com.phonecando.lre.oci.manifest

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException

/**
 * Layer media type → stream compression. Zstd is only marked; whether we
 * can unpack it is the extractor's call. Foreign and non-distributable
 * layers (Windows bases, licensed blobs) live outside the registry and are
 * refused.
 */
internal object LayerTypes {
    private val COMPRESSION = mapOf(
        "application/vnd.oci.image.layer.v1.tar" to Compression.NONE,
        "application/vnd.oci.image.layer.v1.tar+gzip" to Compression.GZIP,
        "application/vnd.oci.image.layer.v1.tar+zstd" to Compression.ZSTD,
        "application/vnd.docker.image.rootfs.diff.tar" to Compression.NONE,
        "application/vnd.docker.image.rootfs.diff.tar.gzip" to Compression.GZIP,
    )

    /** @throws LreException.UnsupportedLayer for foreign, non-distributable or unknown layers. */
    fun compressionOf(layer: Descriptor): Compression {
        val type = layer.mediaType ?: throw LreException.UnsupportedLayer("(no media type)")
        if (!layer.urls.isNullOrEmpty()) throw LreException.UnsupportedLayer(type.take(MAX_TYPE))
        return COMPRESSION[type] ?: throw LreException.UnsupportedLayer(type.take(MAX_TYPE))
    }

    private const val MAX_TYPE = 120
}
