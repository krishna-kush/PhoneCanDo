package com.phonecando.lre.oci.catalog

/**
 * Picks the official operating-system images out of a Hub response: active
 * (not archived, not marked DEPRECATED), with an arm64 build when the
 * response lists architectures.
 */
internal object OfficialOs {
    const val CATEGORY = "operating-systems"

    fun fromSearch(page: SearchPage): List<CatalogImage> = page.results
        .filter { it.badge == "official" && !it.archived && it.categories.any { c -> c.slug == CATEGORY } }
        .filter { it.architectures.isEmpty() || it.architectures.any { a -> a.name == "arm64" } }
        .filter { !deprecated(it.shortDescription) && it.name.isNotEmpty() }
        .map {
            CatalogImage(
                name = pullName(it.id, it.name),
                description = it.shortDescription.orEmpty(),
                pullCount = it.rawPullCount,
                logoUrl = (it.logoUrl?.small ?: it.logoUrl?.large)?.takeIf { url -> url.startsWith("https://") },
            )
        }

    /** The documented listing has no architectures or logos; tags filter arm64 later. */
    fun fromRepositories(page: RepositoryPage): List<CatalogImage> = page.results
        .filter { it.categories.any { c -> c.slug == CATEGORY } }
        .filter { it.status == null || it.status == "active" }
        .filter { !deprecated(it.description) && it.name.isNotEmpty() }
        .map {
            CatalogImage(
                name = pullName("${it.namespace}/${it.name}", it.name),
                description = it.description.orEmpty(),
                pullCount = it.pullCount,
                logoUrl = null,
            )
        }

    private fun deprecated(description: String?): Boolean =
        description?.trimStart()?.startsWith("DEPRECATED", ignoreCase = true) == true

    /** `library/alpine` pulls as `alpine`; others keep their namespace. */
    private fun pullName(id: String?, name: String): String =
        if (id == null || id.startsWith("library/")) name else id
}
