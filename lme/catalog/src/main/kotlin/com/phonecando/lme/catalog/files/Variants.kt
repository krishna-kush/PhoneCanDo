package com.phonecando.lme.catalog.files

import com.phonecando.lme.catalog.ModelVariant
import com.phonecando.lme.catalog.RepoFile

/**
 * A repository's files as the models one can download from it, smallest
 * first. Pure. A variant is a `.gguf` file, or every part of a split one
 * (an incomplete set is dropped). Left out:
 *
 * - companion files that are GGUF but not a model on their own: vision
 *   projectors (`mmproj*`), multi-token-prediction drafts (`mtp-*`) and
 *   importance matrices (`imatrix*`)
 * - files without an LFS sha256: we verify every byte we download
 */
object Variants {
    private val COMPANION_PREFIXES = listOf("mmproj", "mtp-", "imatrix")

    fun of(files: List<RepoFile>): List<ModelVariant> {
        val models = files.filter { isModelFile(it) }
        val singles = models.filter { Shards.part(it.name) == null }.map { ModelVariant(QuantNames.of(it.name), listOf(it)) }
        val splits = models
            .mapNotNull { file -> Shards.part(file.name)?.let { part -> file to part } }
            .groupBy { (file, part) -> Triple(file.path.substringBeforeLast('/', ""), part.stem, part.count) }
            .values
            .mapNotNull { parts ->
                val sorted = parts.sortedBy { it.second.index }
                val complete = sorted.map { it.second.index } == (1..sorted.first().second.count).toList()
                if (complete) ModelVariant(QuantNames.of(sorted.first().first.name), sorted.map { it.first }) else null
            }
        return (singles + splits).sortedWith(compareBy({ it.sizeBytes }, { it.entry.path }))
    }

    private fun isModelFile(file: RepoFile): Boolean {
        val name = file.name.lowercase()
        return name.endsWith(".gguf") && file.sha256 != null && COMPANION_PREFIXES.none { name.startsWith(it) }
    }
}
