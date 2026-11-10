package com.phonecando.lme.catalog.known

import com.phonecando.lme.api.model.BaseModelRef
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.api.model.ModelRecord

/**
 * The known model a GGUF header names as its base, with no network: by its
 * Hugging Face URL, else by name and organization as llama.cpp's converter
 * writes them from the repository ("Qwen3.5 4B" by "Qwen" for
 * Qwen/Qwen3.5-4B). Pure.
 */
object KnownBases {
    private val HUB_URL = Regex("""https?://(?:www\.)?huggingface\.co/([^/?#]+/[^/?#]+)(?:[/?#].*)?""", RegexOption.IGNORE_CASE)

    /** A Hugging Face URL decides alone; name and organization count only without one, and both must match. */
    fun of(ref: BaseModelRef): KnownModel? {
        ref.repoUrl?.let { url -> HUB_URL.matchEntire(url.trim())?.let { return KnownModels.of(it.groupValues[1]) } }
        val name = ref.name?.let(::plain)?.takeIf { it.isNotEmpty() } ?: return null
        val org = ref.organization?.let(::plain)?.takeIf { it.isNotEmpty() } ?: return null
        return KnownModels.MODELS.firstOrNull { plain(it.repo.substringAfter('/')) == name && plain(it.repo.substringBefore('/')) == org }
    }

    /** The dates of a model on the phone: what the catalog saved with it, else its header's base model when we know it. */
    fun dates(record: ModelRecord): ModelDates? = record.dates ?: record.shape.baseModel?.let(::of)?.dates

    private fun plain(text: String): String = text.lowercase().filter { it in 'a'..'z' || it in '0'..'9' }
}
