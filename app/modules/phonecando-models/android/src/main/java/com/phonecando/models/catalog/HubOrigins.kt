package com.phonecando.models.catalog

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.ModelDates
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.ModelHit
import com.phonecando.lme.catalog.OriginFacts
import com.phonecando.lme.catalog.RepoRevision
import com.phonecando.lme.catalog.origin.OriginDates
import com.phonecando.lme.catalog.parameters.ModelSizes
import com.phonecando.lme.catalog.parameters.ParameterCount
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService

/**
 * What we look up about Hugging Face models' originals (lme's
 * HfCatalog.origin): the day each was created on the Hub, for dates
 * (OriginDates), and its checkpoint's parameter count, for sizes
 * (ModelSizes), in one request per original we have not seen, [PARALLEL] at
 * a time. Neither ever changes, so they are kept for the process, and so is
 * an original the Hub says is missing or private. A lookup that fails
 * otherwise leaves its models without them; it never fails the search or
 * the repository page.
 */
class HubOrigins(private val executor: ExecutorService) {
  private val facts = ConcurrentHashMap<String, OriginFacts>()

  /** Looks up what [hits]' dates and sizes need. */
  fun lookUp(hub: HfCatalog, hits: List<ModelHit>) {
    fetch(hub, hits.flatMap { listOfNotNull(OriginDates.lookupFor(it.repo, it.origin), ModelSizes.lookupFor(it.repo, it.origin)) })
  }

  /** Looks up what [hits]' sizes alone need: an original that no name sizes. */
  fun lookUpSizes(hub: HfCatalog, hits: List<ModelHit>) {
    fetch(hub, hits.mapNotNull { ModelSizes.lookupFor(it.repo, it.origin) })
  }

  /** [hit]'s dates from what was looked up; no request. */
  fun dates(hit: ModelHit): ModelDates? = OriginDates.of(hit) { facts[it]?.createdAt }

  /** [hit]'s size from its names and what was looked up; no request. */
  fun size(hit: ModelHit): ParameterCount? = ModelSizes.of(hit.repo, hit.origin) { facts[it]?.parameters }

  fun dates(hub: HfCatalog, revision: RepoRevision): ModelDates? {
    OriginDates.lookupFor(revision.repo, revision.origin)?.let { fetch(hub, listOf(it)) }
    return OriginDates.of(revision) { facts[it]?.createdAt }
  }

  private fun fetch(hub: HfCatalog, origins: List<String>) {
    val missing = origins.distinct().filter { !facts.containsKey(it) }
    for (chunk in missing.chunked(PARALLEL)) {
      chunk.map { origin -> executor.submit { lookup(hub, origin) } }.forEach { future ->
        try {
          future.get()
        } catch (e: ExecutionException) {
          throw e.cause ?: e
        }
      }
    }
  }

  private fun lookup(hub: HfCatalog, origin: String) {
    try {
      facts[origin] = hub.origin(origin)
    } catch (_: LmeException.NotFound) {
      facts[origin] = UNKNOWN
    } catch (_: LmeException.AccessDenied) {
      // Missing or private alike (the Hub answers 401 for both): asking again won't change it.
      facts[origin] = UNKNOWN
    } catch (_: LmeException) {
      // No dates or size for its models this time; the next list asks again.
    }
  }

  private companion object {
    const val PARALLEL = 6

    /** An original the Hub has no page for: kept so no list asks for it again. */
    val UNKNOWN = OriginFacts(null, null)
  }
}
