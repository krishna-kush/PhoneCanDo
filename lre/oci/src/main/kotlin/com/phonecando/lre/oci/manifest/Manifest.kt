package com.phonecando.lre.oci.manifest

import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.decodeOrCorrupt

/** A fetched manifest: a multi-arch [Index] or a single-arch [Image]. */
internal sealed interface Manifest {
    data class Index(val manifests: List<Descriptor>) : Manifest

    data class Image(val config: Descriptor, val layers: List<Descriptor>) : Manifest

    companion object {
        /**
         * Parses manifest [bytes]; the body's `mediaType` wins over the
         * response [contentType]. Docker schema 1 and other kinds are
         * [LreException.UnsupportedManifest].
         */
        fun parse(bytes: ByteArray, contentType: String?): Manifest {
            val doc = decodeOrCorrupt<ManifestDoc>(bytes, "manifest")
            val type = doc.mediaType ?: contentType?.substringBefore(';')?.trim()?.lowercase()
            return when {
                type in MediaTypes.INDEXES -> index(doc)
                type in MediaTypes.MANIFESTS -> image(doc)
                type == null && doc.manifests != null -> index(doc)
                type == null && doc.config != null -> image(doc)
                type == null -> throw LreException.Corrupt("manifest")
                else -> throw LreException.UnsupportedManifest(type.take(MAX_TYPE))
            }
        }

        private fun index(doc: ManifestDoc) = Index(doc.manifests ?: throw LreException.Corrupt("manifest index"))

        private fun image(doc: ManifestDoc) =
            Image(doc.config ?: throw LreException.Corrupt("manifest"), doc.layers.orEmpty())

        private const val MAX_TYPE = 120
    }
}
