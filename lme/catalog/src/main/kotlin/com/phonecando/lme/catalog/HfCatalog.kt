package com.phonecando.lme.catalog

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.http.HttpPort
import com.phonecando.lme.catalog.files.Variants
import com.phonecando.lme.catalog.filters.ChatModels
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.hub.HitJson
import com.phonecando.lme.catalog.hub.HubCalls
import com.phonecando.lme.catalog.hub.HubNames
import com.phonecando.lme.catalog.hub.HubTime
import com.phonecando.lme.catalog.hub.HubUrls
import com.phonecando.lme.catalog.hub.OriginJson
import com.phonecando.lme.catalog.hub.RevisionJson
import com.phonecando.lme.catalog.hub.TreeEntryJson
import com.phonecando.lme.catalog.origin.Origins
import com.phonecando.lme.catalog.parameters.CheckpointSizes
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/**
 * Hugging Face's model catalog through [http]: search GGUF repositories,
 * pin one to a commit, list its files and the models in them, and name the
 * URL each file downloads from. Blocking; call from a background thread.
 *
 * [token] is the user's own access token (gated and private repositories),
 * sent as `Authorization: Bearer` to huggingface.co only and never put in a
 * message or a log. Without it the Hub answers 401 for a repository that is
 * gated, private or missing alike ([LmeException.AccessDenied]).
 */
class HfCatalog(http: HttpPort, token: String? = null) {
    private val calls = HubCalls(http, token)

    /**
     * The first page of GGUF repositories matching [query] (all of them when
     * blank) under [filters]: by default chat models, most downloaded in the
     * last 30 days first. [filters]' size is not applied here: the caller
     * keeps the hits that match it (`filters.ListFill`, `parameters.ModelSizes`).
     */
    fun search(
        query: String,
        filters: ModelFilters = ModelFilters(),
        limit: Int = 30,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): SearchPage {
        require(limit in 1..MAX_LIMIT) { "limit is 1..$MAX_LIMIT" }
        return page(HubUrls.search(query, filters, limit), cancel)
    }

    /** The page after the one whose [SearchPage.next] is [cursor], under the same filters. */
    fun nextPage(cursor: String, cancel: CancelSignal = CancelSignal.NEVER): SearchPage {
        require(cursor.startsWith(HubUrls.MODELS + "?")) { "not a search cursor" }
        return page(cursor, cancel)
    }

    /** [repo] at [ref] (a branch, tag or commit), resolved to its commit sha, with its original model. */
    fun revision(repo: String, ref: String = "main", cancel: CancelSignal = CancelSignal.NEVER): RepoRevision {
        val name = HubNames.repo(repo)
        val what = "repository $name"
        val (doc, _) = calls.get(HubUrls.revision(name, ref), what, cancel) { HubCalls.JSON.decodeFromString<RevisionJson>(it) }
        val sha = doc.sha.takeIf { HubNames.isSha(it) } ?: throw LmeException.Corrupt("$what: no commit sha")
        val gated = (doc.gated as? JsonPrimitive)?.let { it.booleanOrNull ?: it.isString } ?: false
        val origin = Origins.fromCard(name, doc.cardData?.baseModel, doc.cardData?.baseModelRelation, doc.tags)
        return RepoRevision(name, sha, gated, origin, HubTime.day(doc.createdAt))
    }

    /**
     * What the Hub says of [repo] as an original model: the day it was
     * created, for its dates (`origin.OriginDates`), and its checkpoint's
     * parameter count, for its size (`parameters.ModelSizes`).
     */
    fun origin(repo: String, cancel: CancelSignal = CancelSignal.NEVER): OriginFacts {
        val name = HubNames.repo(repo)
        val (doc, _) = calls.get(HubUrls.origin(name), "repository $name", cancel) { HubCalls.JSON.decodeFromString<OriginJson>(it) }
        return OriginFacts(HubTime.day(doc.createdAt), CheckpointSizes.of(doc.safetensors))
    }

    /**
     * Every file of [repo] at commit [sha], subfolders included, following
     * the listing's pages. Entries with an unsafe path are left out.
     */
    fun files(repo: String, sha: String, cancel: CancelSignal = CancelSignal.NEVER): List<RepoFile> {
        val name = HubNames.repo(repo)
        val what = "files of $name"
        val files = ArrayList<RepoFile>()
        var url: String? = HubUrls.tree(name, HubNames.sha(sha))
        var pages = 0
        while (url != null) {
            if (++pages > MAX_TREE_PAGES) throw LmeException.TooLarge(what, MAX_TREE_PAGES.toLong())
            val (entries, next) = calls.get(url, what, cancel) { HubCalls.JSON.decodeFromString<List<TreeEntryJson>>(it) }
            entries.mapNotNullTo(files, ::fileOf)
            url = next
        }
        return files
    }

    /** The models one can download from [files] (see [Variants]). */
    fun variants(files: List<RepoFile>): List<ModelVariant> = Variants.of(files)

    /** Where [file] of [repo] at commit [sha] downloads from (huggingface.co, which redirects to its CDN). */
    fun downloadUrl(repo: String, sha: String, file: RepoFile): String =
        HubUrls.resolve(HubNames.repo(repo), HubNames.sha(sha), file.path)

    private fun page(url: String, cancel: CancelSignal): SearchPage {
        val (hits, next) = calls.get(url, "model search", cancel) { HubCalls.JSON.decodeFromString<List<HitJson>>(it) }
        val chatOnly = HubUrls.isChatOnly(url)
        return SearchPage(
            hits.filter { HubNames.isRepo(it.id) && (!chatOnly || ChatModels.keeps(it.pipelineTag)) }.map {
                ModelHit(it.id, it.downloads, it.likes, it.pipelineTag, HubTime.day(it.createdAt), Origins.fromTags(it.id, it.tags))
            },
            next,
        )
    }

    private fun fileOf(entry: TreeEntryJson): RepoFile? {
        if (entry.type != "file" || entry.size < 0 || !HubNames.isPlainPath(entry.path)) return null
        val lfs = entry.lfs
        val sha256 = lfs?.oid?.takeIf { SHA256.matches(it) && lfs.size == entry.size }
        return RepoFile(entry.path, entry.size, sha256)
    }

    companion object {
        const val MAX_LIMIT = 100
        private const val MAX_TREE_PAGES = 50
        private val SHA256 = Regex("[0-9a-f]{64}")
    }
}
