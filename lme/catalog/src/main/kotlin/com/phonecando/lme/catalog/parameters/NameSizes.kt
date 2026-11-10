package com.phonecando.lme.catalog.parameters

import java.math.BigDecimal

/**
 * The size a repository's name gives its model: "27B", "0.8B", "1.5b",
 * "135M", "1T". Pure.
 *
 * - An MoE named "35B-A3B" is 35B: an A size is the active part, never the
 *   total. With several sizes the largest counts ("OLMoE-1B-7B" is 7B).
 * - "8x7B" is 8 × 7 = 56B.
 * - Gemma's "E2B" is 2B, marked effective: the size Google names it by and
 *   the one it computes at; its per-layer embeddings (the rest of its 5.1B)
 *   are looked up per token, not computed, and llama.cpp maps them from the
 *   file. The repository page's RAM verdict still counts the whole file.
 * - A size stands alone between separators, so "Q4_K_M", "4bit", "v2",
 *   "Qwen3.5", "LFM2", "2507" and "128k" are not sizes; an M size under 10M
 *   is a context length ("7B-Instruct-1M"), not a model size.
 *
 * Only the part after the owner is read: `owner/name`.
 */
internal object NameSizes {
    // An optional expert count ("8x"), an optional A (active) or E (effective)
    // mark, a number and its unit. Not after a letter, digit or dot, nor after
    // "<digit>_" ("stablelm-2-1_6b" is not 6B); not before a letter or digit.
    private val TOKEN = Regex("""(?<![A-Za-z0-9.])(?<!\d_)(?:(\d{1,3})[xX])?([AaEe]?)(\d{1,4}(?:\.\d{1,3})?)([BbMmTt])(?![A-Za-z0-9])""")

    private val UNITS = mapOf(
        "m" to BigDecimal("1e6"),
        "b" to BigDecimal("1e9"),
        "t" to BigDecimal("1e12"),
    )
    private val TEN = BigDecimal.TEN

    // Past 100T a "size" is not a model's.
    private val MAX = BigDecimal("1e14")

    fun of(repo: String): ParameterCount? =
        TOKEN.findAll(repo.substringAfterLast('/')).mapNotNull(::sizeOf).maxByOrNull { it.count }

    private fun sizeOf(match: MatchResult): ParameterCount? {
        val (experts, mark, number, unit) = match.destructured
        if (mark.equals("a", ignoreCase = true)) return null
        val value = BigDecimal(number)
        val scale = UNITS.getValue(unit.lowercase())
        if (scale == UNITS["m"] && value < TEN) return null
        val count = value.multiply(scale).multiply(BigDecimal(experts.ifEmpty { "1" }))
        if (count < BigDecimal.ONE || count > MAX) return null
        return ParameterCount(count.toLong(), effective = mark.isNotEmpty())
    }
}
