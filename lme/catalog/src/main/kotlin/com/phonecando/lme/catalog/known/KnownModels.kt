package com.phonecando.lme.catalog.known

import com.phonecando.lme.api.model.ModelDates
import java.time.YearMonth

/**
 * A model whose dates we checked against its vendor's own model card, blog
 * or report. [repo] is its original repository on Hugging Face; [cutoff],
 * the end of its training data, is null when the vendor publishes none.
 */
data class KnownModel(val repo: String, val released: YearMonth, val cutoff: YearMonth?) {
    val dates: ModelDates.Released get() = ModelDates.Released(released, cutoff)
}

/**
 * The models whose release month and training-data cutoff we state as
 * facts, keyed by the original repository, so any GGUF conversion of them
 * gets the same dates. Every value names its source next to it; a cutoff
 * the vendor does not publish stays null and is never guessed. Checked on
 * 2026-11-09.
 */
object KnownModels {
    val QWEN35_4B = KnownModel(
        repo = "Qwen/Qwen3.5-4B",
        // https://github.com/QwenLM/Qwen3.5#news ("2026-03-02: Qwen3.5-9B, Qwen3.5-4B, Qwen3.5-2B, and Qwen3.5-0.8B are now available")
        released = YearMonth.of(2026, 3),
        // Not published: none in https://huggingface.co/Qwen/Qwen3.5-4B (the model card) or https://github.com/QwenLM/Qwen3.5
        cutoff = null,
    )

    val GEMMA4_E2B_IT = KnownModel(
        repo = "google/gemma-4-E2B-it",
        // https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/ (Apr 02, 2026; E2B is one of its four sizes)
        released = YearMonth.of(2026, 4),
        // https://ai.google.dev/gemma/docs/core/model_card_4 (pre-training data "with a cutoff date of January 2025")
        cutoff = YearMonth.of(2025, 1),
    )

    val QWEN35_9B = KnownModel(
        repo = "Qwen/Qwen3.5-9B",
        // https://github.com/QwenLM/Qwen3.5#news ("2026-03-02: Qwen3.5-9B, Qwen3.5-4B, Qwen3.5-2B, and Qwen3.5-0.8B are now available")
        released = YearMonth.of(2026, 3),
        // Not published: none in https://huggingface.co/Qwen/Qwen3.5-9B (the model card) or https://github.com/QwenLM/Qwen3.5
        cutoff = null,
    )

    val QWEN35_2B = KnownModel(
        repo = "Qwen/Qwen3.5-2B",
        // https://github.com/QwenLM/Qwen3.5#news ("2026-03-02: Qwen3.5-9B, Qwen3.5-4B, Qwen3.5-2B, and Qwen3.5-0.8B are now available")
        released = YearMonth.of(2026, 3),
        // Not published: none in https://huggingface.co/Qwen/Qwen3.5-2B (the model card) or https://github.com/QwenLM/Qwen3.5
        cutoff = null,
    )

    val QWEN35_0_8B = KnownModel(
        repo = "Qwen/Qwen3.5-0.8B",
        // https://github.com/QwenLM/Qwen3.5#news ("2026-03-02: Qwen3.5-9B, Qwen3.5-4B, Qwen3.5-2B, and Qwen3.5-0.8B are now available")
        released = YearMonth.of(2026, 3),
        // Not published: none in https://huggingface.co/Qwen/Qwen3.5-0.8B (the model card) or https://github.com/QwenLM/Qwen3.5
        cutoff = null,
    )

    val MODELS = listOf(QWEN35_4B, GEMMA4_E2B_IT, QWEN35_9B, QWEN35_2B, QWEN35_0_8B)

    /** The known model whose original repository is [repo] (Hub ids ignore case); null when we know none. */
    fun of(repo: String): KnownModel? = MODELS.firstOrNull { it.repo.equals(repo, ignoreCase = true) }
}
