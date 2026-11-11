package com.phonecando.lre.oci.catalog

/**
 * Picks every other operating system out of a Hub search page: active, not
 * official (those have their own list), with an arm64 build when the page
 * lists architectures, and not one of [CommunityOs.CURATED] (the picker
 * shows those first).
 */
internal object UnofficialOs {
    private val curated = CommunityOs.CURATED.map { it.name }.toSet()

    fun fromSearch(page: SearchPage): List<CatalogImage> = page.results
        .filter { it.badge != "official" && !it.archived && !OfficialOs.deprecated(it.shortDescription) }
        .filter { it.architectures.isEmpty() || it.architectures.any { a -> a.name == "arm64" } }
        .mapNotNull { hit ->
            val name = hit.id?.takeIf { '/' in it && !it.startsWith("library/") && it !in curated }
                ?: return@mapNotNull null
            CatalogImage(
                name = name,
                description = hit.shortDescription?.trim().orEmpty(),
                pullCount = hit.rawPullCount,
                logoUrl = hit.logoUrl?.https(),
            )
        }
}
