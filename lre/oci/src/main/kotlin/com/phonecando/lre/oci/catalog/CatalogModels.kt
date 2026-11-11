package com.phonecando.lre.oci.catalog

/** One Docker Hub repository for the image picker. */
data class CatalogImage(
    /** What to pull, ready for `ImageRef.parse`: `alpine` for official images, else `namespace/name`. */
    val name: String,
    val description: String,
    val pullCount: Long?,
    /** https link to the repository's logo, when Docker Hub has one. */
    val logoUrl: String?,
)

/** One tag that has a linux/arm64 image. */
data class CatalogTag(
    val name: String,
    /** Compressed size of the arm64 image, when listed. */
    val sizeArm64: Long?,
    /** ISO-8601 time of the last push, as Docker Hub reports it. */
    val lastUpdated: String?,
    /** Digest of the arm64 image manifest (pin with `ImageRef.withDigest`); the tag's own digest when unlisted. */
    val digest: String?,
)

/** One page of tags; [next] is the page number to ask for next, null on the last page. */
data class TagPage(val tags: List<CatalogTag>, val next: Int?)

/** One page of repositories; [next] is the page number to ask for next, null on the last page. */
data class ImagePage(val images: List<CatalogImage>, val next: Int?)
