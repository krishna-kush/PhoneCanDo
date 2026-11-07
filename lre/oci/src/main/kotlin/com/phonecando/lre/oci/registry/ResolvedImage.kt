package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.oci.ref.ImageRef

/** One layer blob to download, as the arm64 manifest lists it. */
data class LayerDescriptor(
    /** `sha256:<hex>`; also the downloaded file's name (`sha256-<hex>`). */
    val digest: String,
    /** Compressed bytes on the wire. */
    val size: Long,
    val mediaType: String,
    val compression: Compression,
)

/** An image resolved to its linux/arm64 manifest: what [RegistryClient.fetchBlob] downloads. */
data class ResolvedImage(
    val ref: ImageRef,
    /**
     * Digest of the linux/arm64 image manifest (not of the multi-arch
     * index): `ref.withDigest(manifestDigest)` resolves to exactly these
     * layers again, whatever the tag points to by then.
     */
    val manifestDigest: String,
    val config: ImageConfig,
    /** Bottom layer first. */
    val layers: List<LayerDescriptor>,
    /** Registry host that served the manifest (maybe a mirror); downloads try it first. */
    val sourceHost: String,
) {
    /** Bytes to download for all layers. */
    val downloadSize: Long get() = layers.sumOf { it.size }
}
