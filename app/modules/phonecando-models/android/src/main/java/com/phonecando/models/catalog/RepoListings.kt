package com.phonecando.models.catalog

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.catalog.HfCatalog
import com.phonecando.lme.catalog.RepoRevision
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CompletionException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutionException
import java.util.concurrent.ExecutorService

/**
 * Hugging Face repositories at their `main` commit with every file in them
 * (lme's HfCatalog.revision: one request each), kept for the process. The
 * list's size ranges and a repository's page read the same answer, so
 * opening a repository the list sized asks nothing, and neither does its
 * page reading again after a download starts. Two asks for one repository
 * at once share one request; a failed request is not kept.
 */
internal class RepoListings(private val executor: ExecutorService) {
  private val kept = ConcurrentHashMap<String, RepoRevision>()
  private val asking = ConcurrentHashMap<String, CompletableFuture<RepoRevision>>()

  /** [repo] as kept; no request. */
  fun kept(repo: String): RepoRevision? = kept[repo]

  /** [repo] as kept, else from the Hub (or the request already on its way). */
  fun get(hub: HfCatalog, repo: String): RepoRevision {
    kept[repo]?.let { return it }
    val mine = CompletableFuture<RepoRevision>()
    asking.putIfAbsent(repo, mine)?.let { return join(it) }
    try {
      val revision = kept[repo] ?: hub.revision(repo).also { kept[repo] = it }
      mine.complete(revision)
      return revision
    } catch (e: Throwable) {
      mine.completeExceptionally(e)
      throw e
    } finally {
      asking.remove(repo, mine)
    }
  }

  /**
   * Asks the Hub for those of [repos] not kept, [PARALLEL] at a time, while
   * it says at least [RESERVE] calls are left: these asks can wait, a
   * search or a repository the user opens cannot. One that fails or waits
   * leaves its repository without a listing; a later ask tries again.
   */
  fun lookUp(hub: HfCatalog, repos: List<String>) {
    val missing = repos.distinct().filter { !kept.containsKey(it) }
    for (chunk in missing.chunked(PARALLEL)) {
      if (!hub.callsLeft.atLeast(RESERVE)) return
      chunk.map { repo -> executor.submit { tryGet(hub, repo) } }.forEach { future ->
        try {
          future.get()
        } catch (e: ExecutionException) {
          throw e.cause ?: e
        }
      }
    }
  }

  private fun tryGet(hub: HfCatalog, repo: String) {
    try {
      get(hub, repo)
    } catch (_: LmeException) {
      // No listing for it this time.
    }
  }

  private fun join(future: CompletableFuture<RepoRevision>): RepoRevision = try {
    future.join()
  } catch (e: CompletionException) {
    throw e.cause ?: e
  }

  private companion object {
    const val PARALLEL = 6

    /** The Hub's calls (of 500 per 5 minutes without a token) we leave for what the user asks for. */
    const val RESERVE = 100
  }
}
