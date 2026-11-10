package com.phonecando.lme.gguf.shape

/**
 * `general.file_type` (llama.cpp's `llama_ftype`) to the quantisation name
 * Hugging Face file names use. Ids llama.cpp retired are left out.
 */
internal object FileTypes {
    private val NAMES = mapOf(
        0L to "F32", 1L to "F16", 2L to "Q4_0", 3L to "Q4_1", 7L to "Q8_0", 8L to "Q5_0", 9L to "Q5_1",
        10L to "Q2_K", 11L to "Q3_K_S", 12L to "Q3_K_M", 13L to "Q3_K_L", 14L to "Q4_K_S", 15L to "Q4_K_M",
        16L to "Q5_K_S", 17L to "Q5_K_M", 18L to "Q6_K", 19L to "IQ2_XXS", 20L to "IQ2_XS", 21L to "Q2_K_S",
        22L to "IQ3_XS", 23L to "IQ3_XXS", 24L to "IQ1_S", 25L to "IQ4_NL", 26L to "IQ3_S", 27L to "IQ3_M",
        28L to "IQ2_S", 29L to "IQ2_M", 30L to "IQ4_XS", 31L to "IQ1_M", 32L to "BF16", 36L to "TQ1_0",
        37L to "TQ2_0", 38L to "MXFP4_MOE", 39L to "NVFP4", 40L to "Q1_0", 41L to "Q2_0", 42L to "F8_E4M3",
    )

    fun name(fileType: Long): String? = NAMES[fileType]
}
