package com.phonecando.models.catalog

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.ModelVariant
import com.phonecando.lme.catalog.RepoFile
import com.phonecando.lme.catalog.SearchPage
import com.phonecando.lme.catalog.filters.ModelFilters
import com.phonecando.lme.catalog.parameters.ParameterCount
import com.phonecando.lme.catalog.suggested.Suggested
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.store.download.DownloadRequest
import com.phonecando.lme.store.download.RemoteFile
import com.phonecando.models.ModelsHost
import com.phonecando.models.api.datesMap
import com.phonecando.models.ram.RamChecks

/**
 * What the Models page reads from Hugging Face and our suggestions, as JS
 * maps: each model with its RAM verdict on this phone, its dates and size
 * ([HubOrigins]) and, when it is here already, its local id. Network calls
 * block: run them off the JS thread.
 */
class CatalogOps(private val host: ModelsHost) {
  private val origins = HubOrigins(host.executor)
  private val pages = ListPages(origins)
  private val kept = KeptPages()
  private val listings = RepoListings(host.executor)

  /** Our suggestions, best first; no network. Their verdicts count the KV cache at the automatic context here. */
  fun suggested(): List<Map<String, Any?>> {
    val device = host.device.read()
    val local = local()
    return Suggested.MODELS.map { s ->
      mapOf(
        "title" to s.title,
        "note" to s.note,
        "repo" to s.repo,
        "revision" to s.revision,
        "file" to fileMap(s.file),
        "sizeBytes" to s.file.sizeBytes.toDouble(),
        "dates" to datesMap(s.origin.dates),
        "ram" to RamChecks.of(device, LlamaCppRuntime.contextPlan(device, s.file.sizeBytes, s.kvCache, s.contextLength, null)).toMap(),
        "onPhone" to local.model(s.file.sha256),
        "downloadId" to local.download(s.file.sha256),
      )
    }
  }

  /**
   * GGUF repositories matching [query] (all when blank) under [filters]
   * ([ListPages]), as kept when read before ([KeptPages]).
   */
  fun search(query: String, filters: ModelFilters, limit: Int): Map<String, Any?> {
    val hub = host.hub()
    val page = kept.get(KeptPages.First(query, filters, limit)) {
      beforeRequest()
      pages.first(hub, query, filters, limit)
    }
    return pageMap(hub, page)
  }

  /** The page after one whose `next` is [cursor] (a [ListCursor]), under the same filters. */
  fun nextPage(cursor: String): Map<String, Any?> {
    val hub = host.hub()
    val page = kept.get(KeptPages.Next(cursor)) {
      beforeRequest()
      pages.next(hub, cursor)
    }
    return pageMap(hub, page)
  }

  /** Forgets the kept pages and the Hub's limit: the token changed, and with it what the Hub lists and allows. */
  fun tokenChanged() {
    kept.clear()
    host.callsLeft.forget()
  }

  /** Whole seconds until Hugging Face takes calls again after saying none are left (a 429); null while it does. */
  fun cooldownSeconds(): Long? = host.callsLeft.cooldownSeconds()

  /** In the Hub's cooldown, fails at once as the Hub would, instead of sending it a request it refuses. */
  private fun beforeRequest() {
    cooldownSeconds()?.let { throw LmeException.RateLimited(HUB, it) }
  }

  /**
   * The size range of each of [repos] (search hits' names) that we have
   * or may ask for now ([RepoListings.lookUp]); one we can't is left out.
   */
  fun repoSizes(repos: List<String>): Map<String, Any?> {
    val hub = host.hub()
    val asked = repos.take(MAX_SIZES)
    listings.lookUp(hub, asked)
    return asked.mapNotNull { repo -> listings.kept(repo)?.let { repo to sizesMap(hub.variants(it.files)) } }.toMap()
  }

  /**
   * [repo] pinned to its `main` commit, with the models in it, smallest
   * first, as kept when read before ([RepoListings]). A variant's verdict
   * counts its files alone: the KV cache is known only once its header is
   * on the phone.
   */
  fun repo(repo: String): Map<String, Any?> {
    val hub = host.hub()
    val revision = listings.kept(repo) ?: run {
      beforeRequest()
      listings.get(hub, repo)
    }
    val variants = hub.variants(revision.files)
    val device = host.device.read()
    val local = local()
    return mapOf(
      "repo" to revision.repo,
      "revision" to revision.sha,
      "gated" to revision.gated,
      "dates" to datesMap(origins.dates(hub, revision)),
      "variants" to variants.map { v -> variantMap(v, RamChecks.of(device, v.sizeBytes).toMap(), local) },
    )
  }

  /**
   * The download of [files] (a variant's, as [repo] listed them) from [repo]
   * at commit [revision], with the [dates] the listing showed for it.
   */
  fun request(repo: String, revision: String, files: List<RepoFile>, dates: ModelDates?): DownloadRequest {
    val hub = host.hub()
    return DownloadRequest(
      repo = repo,
      revision = revision,
      files = files.map { f ->
        RemoteFile(f.name, hub.downloadUrl(repo, revision, f), f.sizeBytes, f.sha256 ?: throw IllegalArgumentException("${f.name} has no sha256"))
      },
      dates = dates,
    )
  }

  private fun local() = LocalMatch(host.store.models(), host.store.downloads())

  private fun pageMap(hub: HfCatalog, page: SearchPage): Map<String, Any?> {
    origins.lookUp(hub, page.hits)
    return mapOf(
      "hits" to page.hits.map { h ->
        mapOf(
          "repo" to h.repo,
          "downloads" to h.downloads.toDouble(),
          "likes" to h.likes.toDouble(),
          "pipelineTag" to h.pipelineTag,
          "createdAt" to h.createdAt?.toString(),
          "dates" to datesMap(origins.dates(h)),
          "params" to origins.size(h)?.let(::paramsMap),
          "sizes" to listings.kept(h.repo)?.let { sizesMap(hub.variants(it.files)) },
        )
      },
      "next" to page.next,
    )
  }

  // ModelParams in app/src/engine/models/types.ts.
  private fun paramsMap(p: ParameterCount): Map<String, Any?> = mapOf("count" to p.count.toDouble(), "effective" to p.effective)

  // RepoSizes in app/src/engine/models/types.ts: how many models it holds, its smallest and largest download.
  private fun sizesMap(variants: List<ModelVariant>): Map<String, Any?> = mapOf(
    "count" to variants.size,
    "smallest" to (variants.minOfOrNull { it.sizeBytes } ?: 0L).toDouble(),
    "largest" to (variants.maxOfOrNull { it.sizeBytes } ?: 0L).toDouble(),
  )

  private fun variantMap(v: ModelVariant, ram: Map<String, Any?>, local: LocalMatch): Map<String, Any?> = mapOf(
    "quant" to v.quant,
    "files" to v.files.map(::fileMap),
    "sizeBytes" to v.sizeBytes.toDouble(),
    "ram" to ram,
    "onPhone" to local.model(v.entry.sha256),
    "downloadId" to local.download(v.entry.sha256),
  )

  private fun fileMap(f: RepoFile): Map<String, Any?> = mapOf(
    "path" to f.path,
    "sizeBytes" to f.sizeBytes.toDouble(),
    "sha256" to f.sha256,
  )

  private companion object {
    /** A list page's worth: JS asks for the rows that come into view together. */
    const val MAX_SIZES = 30

    const val HUB = "https://huggingface.co"
  }
}
