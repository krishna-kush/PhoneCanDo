package com.phonecando.lre.oci.manifest

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LayerTypesTest {
    private val digest = "sha256:" + "00".repeat(32)

    private fun layer(type: String?, urls: List<String>? = null) = Descriptor(type, digest, 1, urls = urls)

    @Test
    fun `known layer types map to their compression`() {
        val cases = mapOf(
            "application/vnd.oci.image.layer.v1.tar" to Compression.NONE,
            "application/vnd.oci.image.layer.v1.tar+gzip" to Compression.GZIP,
            "application/vnd.oci.image.layer.v1.tar+zstd" to Compression.ZSTD,
            "application/vnd.docker.image.rootfs.diff.tar.gzip" to Compression.GZIP,
            "application/vnd.docker.image.rootfs.diff.tar" to Compression.NONE,
        )
        cases.forEach { (type, compression) -> assertEquals(compression, LayerTypes.compressionOf(layer(type)), type) }
    }

    @Test
    fun `foreign, non-distributable and unknown layers are unsupported`() {
        val refused = listOf(
            "application/vnd.docker.image.rootfs.foreign.diff.tar.gzip",
            "application/vnd.oci.image.layer.nondistributable.v1.tar+gzip",
            "application/vnd.oci.image.layer.nondistributable.v1.tar+zstd",
            "application/vnd.oci.image.layer.v1.tar+bzip2",
            "application/x-tar",
        )
        refused.forEach { type ->
            assertEquals(type, assertThrows<LreException.UnsupportedLayer>(type) { LayerTypes.compressionOf(layer(type)) }.mediaType)
        }
        assertThrows<LreException.UnsupportedLayer> {
            LayerTypes.compressionOf(layer("application/vnd.oci.image.layer.v1.tar+gzip", urls = listOf("https://x.test/l")))
        }
        assertThrows<LreException.UnsupportedLayer> { LayerTypes.compressionOf(layer(null)) }
    }

    @Test
    fun `arm64 means linux arm64 with variant v8 or none`() {
        assertTrue(Arm64.matches("linux", "arm64", null))
        assertTrue(Arm64.matches("linux", "arm64", ""))
        assertTrue(Arm64.matches("linux", "arm64", "v8"))
        assertFalse(Arm64.matches("linux", "arm64", "v9"))
        assertFalse(Arm64.matches("linux", "arm", "v7"))
        assertFalse(Arm64.matches("windows", "arm64", null))
        assertFalse(Arm64.matches("unknown", "unknown", null))

        val attestation = Descriptor(MediaTypes.OCI_MANIFEST, digest, 1, Platform("unknown", "unknown"))
        val amd64 = Descriptor(MediaTypes.OCI_MANIFEST, digest, 1, Platform("amd64", "linux"))
        val arm64 = Descriptor(MediaTypes.OCI_MANIFEST, "sha256:" + "11".repeat(32), 1, Platform("arm64", "linux", "v8"))
        assertEquals(arm64, Arm64.pick(listOf(amd64, attestation, arm64)))
        assertNull(Arm64.pick(listOf(amd64, attestation)))
        assertNotNull(Arm64.pick(listOf(arm64.copy(mediaType = null))))
    }
}
