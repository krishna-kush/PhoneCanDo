package com.phonecando.lre.oci.manifest

/** What runs on the phone: linux/arm64, variant `v8` or none. */
internal object Arm64 {
    fun matches(os: String?, architecture: String?, variant: String?): Boolean =
        os == "linux" && architecture == "arm64" && (variant.isNullOrEmpty() || variant == "v8")

    /** The first linux/arm64 image manifest in an index (attestations have no such platform). */
    fun pick(manifests: List<Descriptor>): Descriptor? = manifests.firstOrNull { entry ->
        val platform = entry.platform ?: return@firstOrNull false
        (entry.mediaType == null || entry.mediaType in MediaTypes.MANIFESTS) &&
            matches(platform.os, platform.architecture, platform.variant)
    }
}
