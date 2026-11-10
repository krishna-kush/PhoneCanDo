package com.phonecando.lme.catalog.hub

import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.catalog.filters.ModelFilters
import java.net.URLEncoder

/** The Hugging Face URLs we call, built from checked names. */
internal object HubUrls {
    const val HUB = ModelSource.HuggingFace.ORIGIN
    const val MODELS = "$HUB/api/models"

    /**
     * GGUF repositories under [filters], matching [query] when it is not
     * blank. `filter` values add up (all must hold); the Hub's next-page
     * link carries every parameter on. The size filter is not sent: we
     * match it ourselves ([com.phonecando.lme.catalog.filters.ModelSize]).
     */
    fun search(query: String, filters: ModelFilters, limit: Int): String = buildString {
        append(MODELS).append("?filter=gguf")
        if (filters.chatOnly) append("&filter=").append(CHAT_TAG)
        filters.license?.let { append("&filter=").append(encode("license:${it.tag}")) }
        append("&sort=").append(filters.sort.hub).append("&direction=-1&limit=").append(limit)
        query.trim().takeIf { it.isNotEmpty() }?.let { append("&search=").append(encode(it)) }
    }

    /** True when the listing at [url] (a first page, or a next-page link the Hub gave) keeps chat models only. */
    fun isChatOnly(url: String): Boolean = url.substringAfter('?', "").split('&').contains("filter=$CHAT_TAG")

    /** The Hub's tag for chat models; it leaves out speech, video and most embedding models. */
    private const val CHAT_TAG = "conversational"

    /** `expand[]` keeps the answer to the fields we read (brackets encoded: java.net.URI refuses them raw). */
    fun revision(repo: String, ref: String): String =
        "$MODELS/$repo/revision/${encode(ref)}?" + expand("sha", "gated", "cardData", "tags", "createdAt")

    /** An original model's creation time and checkpoint size alone, for its dates and its size. */
    fun origin(repo: String): String = "$MODELS/$repo?" + expand("createdAt", "safetensors")

    fun tree(repo: String, sha: String): String = "$MODELS/$repo/tree/$sha?recursive=true"

    fun resolve(repo: String, sha: String, path: String): String =
        "$HUB/$repo/resolve/$sha/" + path.split('/').joinToString("/") { encode(it) }

    /** True for URLs on the Hub itself, the only host our token may go to. */
    fun isHub(url: String): Boolean = url.startsWith("$HUB/")

    private fun expand(vararg fields: String): String = fields.joinToString("&") { "expand%5B%5D=$it" }

    private fun encode(text: String): String = URLEncoder.encode(text, "UTF-8").replace("+", "%20")
}
