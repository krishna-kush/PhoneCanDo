package com.phonecando.lme.catalog

import java.time.LocalDate

/**
 * One search result: a model repository on Hugging Face, created on the Hub
 * on [createdAt] (UTC). [origin] is the repository of its original model:
 * the model it converts, or itself ([com.phonecando.lme.catalog.origin.Origins]).
 */
data class ModelHit(
    val repo: String,
    val downloads: Long,
    val likes: Long,
    val pipelineTag: String?,
    val createdAt: LocalDate?,
    val origin: String,
)

/**
 * What the Hub says of an original model ([HfCatalog.origin]): the day (UTC)
 * it was created, for its dates, and its checkpoint's parameter count, for
 * its size; each null when the Hub does not say.
 */
data class OriginFacts(val createdAt: LocalDate?, val parameters: Long?)

/** One page of search results; [next] is the cursor for [HfCatalog.nextPage], null on the last page. */
data class SearchPage(val hits: List<ModelHit>, val next: String?)

/**
 * A repository pinned to one commit, with every file in it. [gated]
 * repositories need a token from an account that accepted the model's
 * terms on huggingface.co. [origin] and [createdAt] are as on [ModelHit].
 */
data class RepoRevision(
    val repo: String,
    val sha: String,
    val gated: Boolean,
    val origin: String,
    val createdAt: LocalDate?,
    val files: List<RepoFile>,
)

/**
 * One file in a repository at a commit: its path, size and, for files kept
 * in LFS (every GGUF file), the sha256 Hugging Face lists for it.
 */
data class RepoFile(val path: String, val sizeBytes: Long, val sha256: String?) {
    val name: String get() = path.substringAfterLast('/')
}

/**
 * One downloadable model in a repository: a single GGUF file, or every part
 * of a split one in order. [quant] comes from the file name (`Q4_K_M`).
 */
data class ModelVariant(val quant: String?, val files: List<RepoFile>) {
    val entry: RepoFile get() = files.first()

    val sizeBytes: Long get() = files.sumOf { it.sizeBytes }
}
