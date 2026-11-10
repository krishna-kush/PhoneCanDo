package com.phonecando.lme.catalog.files

/**
 * The quantisation a GGUF file name states: the last `-` or `.` separated
 * word that reads as one (`Q4_K_M`, `IQ4_XS`, `Q8_0`, `BF16`, `MXFP4`),
 * upper-cased, with Unsloth's `UD-` kept in front. Null when the name has
 * none. Pure.
 */
object QuantNames {
    private val QUANT = Regex(
        "I?Q[0-9]+(_[A-Z0-9]+)+|TQ[0-9]_[0-9]|MXFP4(_MOE)?|NVFP4|BF16|F16|F32|F8_E4M3",
        RegexOption.IGNORE_CASE,
    )

    fun of(fileName: String): String? {
        val stem = Shards.stem(fileName.substringAfterLast('/')).removeSuffix(".gguf").removeSuffix(".GGUF")
        val words = stem.split('-', '.')
        val at = words.indexOfLast { QUANT.matches(it) }
        if (at < 0) return null
        val quant = words[at].uppercase()
        return if (at > 0 && words[at - 1].equals("UD", ignoreCase = true)) "UD-$quant" else quant
    }
}
