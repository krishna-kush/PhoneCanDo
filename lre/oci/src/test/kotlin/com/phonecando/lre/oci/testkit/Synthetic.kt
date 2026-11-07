package com.phonecando.lre.oci.testkit

import kotlin.random.Random

/** Small hand-built images for download tests (the recorded alpine layer is 4 MB). */
object Synthetic {
    const val GZIP_LAYER = "application/vnd.oci.image.layer.v1.tar+gzip"
    private const val OCI_CONFIG = "application/vnd.oci.image.config.v1+json"

    fun bytes(size: Int, seed: Int = 1): ByteArray = Random(seed).nextBytes(size)

    fun config(architecture: String = "arm64", runtime: String = """{"Env":["PATH=/usr/bin:/bin"],"Cmd":["/bin/sh"]}"""): ByteArray =
        """{"architecture":"$architecture","os":"linux","config":$runtime,"rootfs":{"type":"layers","diff_ids":[]}}""".toByteArray()

    /** An OCI image manifest; each layer is (mediaType, digest, size) plus optional extra JSON. */
    fun manifest(config: ByteArray, layers: List<Layer>, mediaType: String = Fixtures.OCI_MANIFEST): ByteArray {
        val layerJson = layers.joinToString(",") {
            """{"mediaType":"${it.mediaType}","digest":"${it.digest}","size":${it.size}${it.extra}}"""
        }
        return ("""{"schemaVersion":2,"mediaType":"$mediaType",""" +
            """"config":{"mediaType":"$OCI_CONFIG","digest":"${Fixtures.sha256(config)}","size":${config.size}},""" +
            """"layers":[$layerJson]}""").toByteArray()
    }

    data class Layer(val mediaType: String, val digest: String, val size: Long, val extra: String = "")

    /** Serves a one-layer arm64 image under [tag]; returns the layer bytes. */
    fun serveImage(registry: FakeRegistry, tag: String, layer: ByteArray, mediaType: String = GZIP_LAYER): ByteArray {
        val config = config()
        registry.blob(config)
        val digest = registry.blob(layer)
        registry.manifest(tag, manifest(config, listOf(Layer(mediaType, digest, layer.size.toLong()))), Fixtures.OCI_MANIFEST)
        return layer
    }
}
