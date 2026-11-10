package com.phonecando.lme.gguf.read

/**
 * One metadata value. Big values are read through, not kept: a string over
 * [GgufLimits.keptStringBytes] or an array over [GgufLimits.keptArrayItems]
 * (the tokenizer's vocabulary) comes back as [Skipped].
 */
sealed interface GgufValue {
    /** Any integer type. A `uint64` above [Long.MAX_VALUE] is [Skipped] instead. */
    data class Integer(val value: Long) : GgufValue

    data class Real(val value: Double) : GgufValue

    data class Bool(val value: Boolean) : GgufValue

    data class Text(val value: String) : GgufValue

    data class Items(val elementType: GgufType, val values: List<GgufValue>) : GgufValue

    /** Read through and dropped; [count] is bytes for a string, items for an array. */
    data class Skipped(val type: GgufType, val count: Long) : GgufValue
}
