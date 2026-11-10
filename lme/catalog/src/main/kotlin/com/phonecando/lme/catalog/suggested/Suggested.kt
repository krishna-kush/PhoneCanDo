package com.phonecando.lme.catalog.suggested

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.catalog.RepoFile
import com.phonecando.lme.catalog.known.KnownModel
import com.phonecando.lme.catalog.known.KnownModels

/**
 * A model we suggest, pinned to one commit and file, with what its GGUF
 * header says about its context and KV cache, so the RAM verdict needs no
 * download, and the original model it converts, whose dates we checked.
 * The browser stays open to any model; these only come first.
 */
data class SuggestedModel(
    val title: String,
    val note: String,
    val repo: String,
    val origin: KnownModel,
    val revision: String,
    val file: RepoFile,
    val contextLength: Long,
    val kvCache: KvCacheShape,
)

/**
 * Our suggestions, best first. Repository, commit, size and sha256 as
 * huggingface.co listed them on 2026-11-09; context and KV cache from each
 * file's header (`lme/gguf`).
 */
object Suggested {
    val MODELS = listOf(
        SuggestedModel(
            title = "Qwen3.5 4B",
            note = "Balanced: our default pick",
            repo = "unsloth/Qwen3.5-4B-GGUF",
            origin = KnownModels.QWEN35_4B,
            revision = "e87f176479d0855a907a41277aca2f8ee7a09523",
            file = RepoFile(
                "Qwen3.5-4B-Q4_K_M.gguf",
                2_740_937_888,
                "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4",
            ),
            contextLength = 262_144,
            kvCache = KvCacheShape(16_384, 0, null),
        ),
        SuggestedModel(
            title = "Gemma 4 E2B",
            note = "Fastest",
            repo = "unsloth/gemma-4-E2B-it-GGUF",
            origin = KnownModels.GEMMA4_E2B_IT,
            revision = "0314792d7f1f7e229411f620751375812bb9faf2",
            file = RepoFile(
                "gemma-4-E2B-it-Q4_K_M.gguf",
                3_106_738_272,
                "740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8",
            ),
            contextLength = 131_072,
            kvCache = KvCacheShape(3_072, 6_144, 512),
        ),
        SuggestedModel(
            title = "Qwen3.5 9B",
            note = "Strongest; needs the most RAM",
            repo = "unsloth/Qwen3.5-9B-GGUF",
            origin = KnownModels.QWEN35_9B,
            revision = "3885219b6810b007914f3a7950a8d1b469d598a5",
            file = RepoFile(
                "Qwen3.5-9B-Q4_K_M.gguf",
                5_680_522_464,
                "03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8",
            ),
            contextLength = 262_144,
            kvCache = KvCacheShape(16_384, 0, null),
        ),
    )
}
