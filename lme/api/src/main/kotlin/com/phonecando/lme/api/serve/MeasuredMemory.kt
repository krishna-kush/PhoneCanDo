package com.phonecando.lme.api.serve

/**
 * What the model server itself counts for one model on one phone: its
 * runtime's own sizes at one context, read before a start (llama.cpp's
 * `--fit` dry run). The weights it copies into the CPU's own layouts depend
 * on which kernels the phone's CPU has, so a measurement holds for the
 * phone and the server build it was taken on ([phone]) and is taken again
 * on any other.
 *
 * @property phone what it was measured on ([phoneTag]): another tag means
 *   another phone or server build
 * @property context the context it was measured at, in tokens
 * @property halfKvCache measured with an 8-bit KV cache
 * @property mappedBytes weights read in place from the model's files: file
 *   pages Android may reclaim, which every token reads
 * @property copiedBytes weights the server copied into its CPU's own
 *   layouts as it loaded (llama.cpp's repacked buffers): anonymous memory
 * @property stateBytes the KV cache and recurrent state at [context]
 * @property computeBytes the compute buffer at [context]
 */
data class MeasuredMemory(
    val phone: String,
    val context: Long,
    val halfKvCache: Boolean,
    val mappedBytes: Long,
    val copiedBytes: Long,
    val stateBytes: Long,
    val computeBytes: Long,
) {
    init {
        require(context >= 1) { "measured at a context of at least one token" }
        require(mappedBytes >= 0 && copiedBytes >= 0 && stateBytes >= 0 && computeBytes >= 0) { "sizes are zero or more" }
    }

    companion object {
        /**
         * A phone and server build as a measurement names them: the CPU
         * features every core has (which kernels apply) and the server
         * binary's size (another build may copy other weights).
         */
        fun phoneTag(cpuFeatures: Set<String>, serverBytes: Long): String =
            "cpu=${cpuFeatures.sorted().joinToString(",")};server=$serverBytes"
    }
}
