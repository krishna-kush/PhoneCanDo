package com.phonecando.lme.catalog.parameters

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * A checkpoint's parameter count from the Hub's `safetensors` field
 * (`{"parameters": {"BF16": 27781427952}, "total": 27781427952}`). Pure; an
 * odd shape is no count, never a failed lookup.
 *
 * Floats (F64, F32, F16, BF16, F8_*) are one parameter per element, so a
 * checkpoint stored that way (99% of it; a few I64 buffers do not matter)
 * counts as it says. An integer type may hold packed weights (4-bit values
 * two to a byte, eight to an I32), one parameter or more per element, so
 * its count is only a lower bound: we take it past [LOWER_BOUND_FROM], the
 * last size bucket's edge, where whatever the packing the model is over
 * 10B (DeepSeek-V4.1-Flash: 763B, mostly I8; its GGUF header says 748B).
 */
internal object CheckpointSizes {
    /** The edge of `filters.ModelSize.OVER_10B`. */
    const val LOWER_BOUND_FROM = 10_000_000_000L

    fun of(safetensors: JsonElement?): Long? {
        val field = safetensors as? JsonObject ?: return null
        val total = number(field["total"])?.takeIf { it in 1..MAX } ?: return null
        val byType = field["parameters"] as? JsonObject ?: return null
        var all = 0L
        var floats = 0L
        for ((type, value) in byType) {
            val count = number(value)?.takeIf { it in 0..MAX } ?: return null
            all += count
            if (isFloat(type)) floats += count
        }
        if (all == 0L) return null
        return total.takeIf { floats * 100 >= all * 99 || it > LOWER_BOUND_FROM }
    }

    // Past 100T a count is not a model's (and the sums stay far from overflow).
    private const val MAX = 100_000_000_000_000L

    private fun number(element: JsonElement?): Long? = (element as? JsonPrimitive)?.takeIf { !it.isString }?.longOrNull

    private fun isFloat(type: String): Boolean =
        type == "F64" || type == "F32" || type == "F16" || type == "BF16" || type.startsWith("F8_")
}
