package com.phonecando.lre.oci.catalog

import com.phonecando.lre.oci.manifest.Arm64

/** Keeps the tags of one Hub page that have a linux/arm64 image, in picker order. */
internal object Arm64Tags {
    fun from(page: TagListPage): List<CatalogTag> = TagOrder.sort(
        page.results.mapNotNull { tag ->
            val image = tag.images.firstOrNull { Arm64.matches(it.os, it.architecture, it.variant) }
                ?: return@mapNotNull null
            CatalogTag(
                name = tag.name,
                sizeArm64 = image.size,
                lastUpdated = tag.lastUpdated,
                digest = image.digest ?: tag.digest,
            )
        }.filter { it.name.isNotEmpty() },
    )
}
