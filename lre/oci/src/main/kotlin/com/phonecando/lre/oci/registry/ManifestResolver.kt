package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.blob.Digest
import com.phonecando.lre.oci.blob.Sha256
import com.phonecando.lre.oci.decodeOrCorrupt
import com.phonecando.lre.oci.manifest.Arm64
import com.phonecando.lre.oci.manifest.ConfigDoc
import com.phonecando.lre.oci.manifest.Descriptor
import com.phonecando.lre.oci.manifest.LayerTypes
import com.phonecando.lre.oci.manifest.Manifest
import com.phonecando.lre.oci.manifest.MediaTypes
import com.phonecando.lre.oci.manifest.isArm64
import com.phonecando.lre.oci.manifest.toImageConfig
import com.phonecando.lre.oci.ref.ImageRef

/**
 * Turns a reference into its linux/arm64 manifest and config on one
 * source, verifying every byte against its digest.
 */
internal class ManifestResolver(private val http: RegistryHttp) {
    fun resolveFrom(source: RegistrySource, ref: ImageRef, cancel: CancelSignal): ResolvedImage {
        val name = ref.toString()
        val what = "image $name"
        val (topDigest, top) = manifest(source, ref.reference, ref.digest?.let(Digest::parse), what, cancel)
        val (digest, image, platformChosen) = when (top) {
            is Manifest.Image -> Triple(topDigest, top, false)
            is Manifest.Index -> {
                val entry = Arm64.pick(top.manifests) ?: throw LreException.NoArm64(name)
                val entryDigest = Digest.parse(entry.digest)
                val (childDigest, child) = manifest(source, entryDigest.toString(), entryDigest, what, cancel)
                val image = child as? Manifest.Image ?: throw LreException.Corrupt("manifest index of $name")
                Triple(childDigest, image, true)
            }
        }
        val config = config(source, image.config, name, cancel)
        if (!config.isArm64(platformChosen)) throw LreException.NoArm64(name)
        val layers = image.layers.map(::layer)
        return ResolvedImage(ref, digest.toString(), config.toImageConfig(), layers, source.host)
    }

    /** Fetches a manifest; checks it against [expected] (a pinned digest) or the registry's own digest header. */
    private fun manifest(
        source: RegistrySource,
        reference: String,
        expected: Digest?,
        what: String,
        cancel: CancelSignal,
    ): Pair<Digest, Manifest> {
        val body = http.read(source, "manifests/$reference", mapOf("Accept" to MediaTypes.MANIFEST_ACCEPT), what, MANIFEST_LIMIT, cancel)
        val actual = Digest(Sha256.hex(body.bytes))
        if (expected != null && actual != expected) throw LreException.DigestMismatch(expected.toString(), actual.toString())
        val claimed = body.contentDigest?.trim()
        if (expected == null && claimed != null && claimed.startsWith("${Digest.ALGORITHM}:") && claimed != actual.toString()) {
            throw LreException.DigestMismatch(claimed.take(80), actual.toString())
        }
        return actual to Manifest.parse(body.bytes, body.contentType)
    }

    private fun config(source: RegistrySource, descriptor: Descriptor, name: String, cancel: CancelSignal): ConfigDoc {
        val digest = Digest.parse(descriptor.digest)
        if (descriptor.size > CONFIG_LIMIT) throw LreException.TooLarge("image config", CONFIG_LIMIT)
        val body = http.read(source, "blobs/$digest", emptyMap(), "config of $name", CONFIG_LIMIT, cancel)
        val actual = Digest(Sha256.hex(body.bytes))
        if (actual != digest) throw LreException.DigestMismatch(digest.toString(), actual.toString())
        return decodeOrCorrupt(body.bytes, "image config")
    }

    private fun layer(descriptor: Descriptor): LayerDescriptor {
        val compression = LayerTypes.compressionOf(descriptor)
        val digest = Digest.parse(descriptor.digest)
        if (descriptor.size < 0) throw LreException.Corrupt("layer size of $digest")
        return LayerDescriptor(digest.toString(), descriptor.size, descriptor.mediaType!!, compression)
    }

    private companion object {
        const val MANIFEST_LIMIT = 4L * 1024 * 1024
        const val CONFIG_LIMIT = 4L * 1024 * 1024
    }
}
