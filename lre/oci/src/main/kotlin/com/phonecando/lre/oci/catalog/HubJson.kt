package com.phonecando.lre.oci.catalog

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `GET /api/search/v4` (the search behind hub.docker.com's own pages). */
@Serializable
internal data class SearchPage(val results: List<SearchResult> = emptyList())

@Serializable
internal data class SearchResult(
    val id: String? = null,
    val name: String = "",
    val badge: String? = null,
    @SerialName("short_description") val shortDescription: String? = null,
    @SerialName("raw_pull_count") val rawPullCount: Long? = null,
    val archived: Boolean = false,
    val architectures: List<Named> = emptyList(),
    val categories: List<Category> = emptyList(),
    @SerialName("logo_url") val logoUrl: LogoUrl? = null,
)

@Serializable
internal data class Named(val name: String = "")

@Serializable
internal data class Category(val slug: String = "")

@Serializable
internal data class LogoUrl(val small: String? = null, val large: String? = null)

/** `GET /v2/namespaces/{namespace}/repositories` (documented Hub API). */
@Serializable
internal data class RepositoryPage(val results: List<RepositoryEntry> = emptyList())

@Serializable
internal data class RepositoryEntry(
    val name: String = "",
    val namespace: String = "",
    val description: String? = null,
    @SerialName("pull_count") val pullCount: Long? = null,
    val categories: List<Category> = emptyList(),
    @SerialName("status_description") val status: String? = null,
)

/** `GET /v2/namespaces/{namespace}/repositories/{repository}/tags` (documented Hub API). */
@Serializable
internal data class TagListPage(
    val next: String? = null,
    val results: List<TagEntry> = emptyList(),
)

@Serializable
internal data class TagEntry(
    val name: String = "",
    @SerialName("last_updated") val lastUpdated: String? = null,
    val digest: String? = null,
    val images: List<TagImage> = emptyList(),
)

@Serializable
internal data class TagImage(
    val architecture: String? = null,
    val os: String? = null,
    val variant: String? = null,
    val digest: String? = null,
    val size: Long? = null,
)
