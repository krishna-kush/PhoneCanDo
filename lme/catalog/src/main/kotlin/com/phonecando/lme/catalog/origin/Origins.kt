package com.phonecando.lme.catalog.origin

import com.phonecando.lme.catalog.hub.HubNames
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

/**
 * Which repository holds a Hugging Face repository's original model: the
 * first base model it names, when it is a conversion of that model (a
 * quantization, as nearly every GGUF repository of someone else's model
 * is), else the repository itself. A finetune, merge or adapter is a model
 * of its own. Pure.
 *
 * The base is the model card's first `base_model` entry (a string or a
 * list) or, in a search result, the first of the Hub's `base_model:<repo>`
 * tags, which it writes from that entry. The relation is the card's
 * `base_model_relation`, else the Hub's `base_model:<relation>:<repo>` tag.
 */
internal object Origins {
    private const val TAG = "base_model:"
    private val OWN_MODEL = setOf("finetune", "merge", "adapter")

    /** From a revision: its card's `base_model` and `base_model_relation`, and its tags. */
    fun fromCard(repo: String, baseModel: JsonElement?, relation: JsonElement?, tags: List<String>): String {
        val first = if (baseModel is JsonArray) baseModel.firstOrNull() else baseModel
        val base = text(first)
        return origin(repo, base, text(relation) ?: relationOf(tags, base))
    }

    /** From a search hit: its tags alone. */
    fun fromTags(repo: String, tags: List<String>): String {
        val links = links(tags)
        val base = (links.firstOrNull { it.relation == null } ?: links.firstOrNull())?.repo
        return origin(repo, base, relationOf(tags, base))
    }

    private fun origin(repo: String, base: String?, relation: String?): String =
        if (base == null || !HubNames.isRepo(base) || relation?.lowercase() in OWN_MODEL) repo else base

    private fun relationOf(tags: List<String>, base: String?): String? =
        base?.let { b -> links(tags).firstOrNull { it.relation != null && it.repo.equals(b, ignoreCase = true) }?.relation }

    private class Link(val relation: String?, val repo: String)

    // "base_model:Qwen/Qwen3.5-4B" and "base_model:quantized:Qwen/Qwen3.5-4B"; a repository id has no ':'.
    private fun links(tags: List<String>): List<Link> = tags.filter { it.startsWith(TAG) }.map { tag ->
        val rest = tag.removePrefix(TAG)
        if (':' in rest) Link(rest.substringBefore(':'), rest.substringAfter(':')) else Link(null, rest)
    }

    private fun text(element: JsonElement?): String? =
        (element as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim()?.takeIf { it.isNotEmpty() }
}
