package com.phonecando.lme.gguf.shape

/**
 * Which layers of a sliding-window model keep only the window, the way
 * llama.cpp decides it (`llama_hparams::set_swa_pattern`), and the period
 * each architecture assumes when its GGUF names a window
 * (`attention.sliding_window`) but no pattern: the one its model file
 * passes to `load_swa_pattern` at the pinned version (v0.9.0,
 * `src/models/<arch>.cpp`), and whether the full layer comes first in each
 * group of that many (`dense_first`). phi3's period of 1 is llama.cpp's way
 * of keeping no window for it. An architecture not here, or one whose
 * window depends on more (exaone4: only its 64-layer model), has no rule:
 * [KvLayers] then counts every layer both ways. Recheck on a pin bump.
 * Pure.
 */
internal object SwaPatterns {
    data class Rule(val period: Long, val denseFirst: Boolean = false)

    private val RULES = mapOf(
        "gemma2" to Rule(2),
        "gpt-oss" to Rule(2),
        "modern-bert" to Rule(3, denseFirst = true),
        "cohere2" to Rule(4),
        "olmo2" to Rule(4),
        "llama4" to Rule(4),
        "afmoe" to Rule(4),
        "mellum" to Rule(4),
        "limite" to Rule(4),
        "exaone-moe" to Rule(4),
        "muse-glimmer" to Rule(4),
        "cohere2moe" to Rule(4, denseFirst = true),
        "smallthinker" to Rule(4, denseFirst = true),
        "laguna" to Rule(4, denseFirst = true),
        "gemma3n" to Rule(5),
        "gemma3" to Rule(6),
        "gemma-embedding" to Rule(6),
        "gemma-embedding2" to Rule(6),
        "plamo3" to Rule(8),
        "phi3" to Rule(1),
    )

    /** llama.cpp's own period for [arch]; null when we do not know it. */
    fun of(arch: String): Rule? = RULES[arch]

    /**
     * Which of [layers] are windowed for [period]: all but the full one of
     * each group of [period] (the last, or the first when [denseFirst]); a
     * period of 0 windows every layer.
     */
    fun windowed(period: Long, denseFirst: Boolean, layers: Int): BooleanArray = BooleanArray(layers) { il ->
        period == 0L || if (denseFirst) il % period != 0L else il % period < period - 1
    }
}
