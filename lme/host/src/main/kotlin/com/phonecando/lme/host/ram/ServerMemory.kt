package com.phonecando.lme.host.ram

import com.phonecando.lme.api.serve.MeasuredMemory

/**
 * What a model's server holds besides one prompt's state ([PromptState]):
 * its weights, as file pages read in place ([mappedBytes]) and as copies in
 * the CPU's own layouts ([copiedBytes]), and its compute buffer at a
 * context ([computeBytes]). From the server's own count on this phone
 * ([measured]) once we have one, else a safe [estimated] guess. Pure.
 *
 * @property measured from a [MeasuredMemory]; false: estimated (or
 *   [filesOnly])
 */
class ServerMemory private constructor(
    val mappedBytes: Long,
    val copiedBytes: Long,
    val measured: Boolean,
    private val compute: (Long) -> Long,
) {
    /** All its weights hold: what the RAM gate counts for them. */
    val weightsBytes: Long get() = mappedBytes + copiedBytes

    /** The compute buffer at [context] tokens. */
    fun computeBytes(context: Long): Long = compute(context)

    companion object {
        private const val MIB = 1L shl 20

        /**
         * The server's own count. The compute buffer grows with the context
         * (its attention mask is one row per token); at a context past the
         * one measured it grows in step, which is more than it really adds,
         * and below it stays as measured.
         */
        fun measured(m: MeasuredMemory): ServerMemory = ServerMemory(m.mappedBytes, m.copiedBytes, true) { context ->
            if (context <= m.context) m.computeBytes else ceilDiv(m.computeBytes * context, m.context)
        }

        /**
         * Before the first measurement of a model of [sizeBytes] on this
         * phone: every weight counted twice, once in the file's pages and
         * once copied ([RamRules.COPIED_WEIGHTS_PERCENT]), and a compute
         * buffer of [RamRules.COMPUTE_BASE_MIB] (or a [RamRules.COMPUTE_SIZE_DIVISOR]th
         * of the files, when more) plus [RamRules.COMPUTE_BYTES_PER_TOKEN]
         * per token of context. Safe on what we measured (see [RamRules]).
         */
        fun estimated(sizeBytes: Long): ServerMemory {
            val base = maxOf(RamRules.COMPUTE_BASE_MIB * MIB, sizeBytes / RamRules.COMPUTE_SIZE_DIVISOR)
            return ServerMemory(sizeBytes, sizeBytes * RamRules.COPIED_WEIGHTS_PERCENT / 100, false) { context ->
                base + context * RamRules.COMPUTE_BYTES_PER_TOKEN
            }
        }

        /** [measured] when there is a measurement, else [estimated]. */
        fun of(sizeBytes: Long, measured: MeasuredMemory?): ServerMemory = measured?.let(::measured) ?: estimated(sizeBytes)

        /**
         * The files alone, no copies and no compute buffer: what we planned
         * before we counted either. The least any phone needs; the phone
         * sizes `suggested.json` claims still count only this.
         */
        fun filesOnly(sizeBytes: Long): ServerMemory = ServerMemory(sizeBytes, 0, false) { 0L }

        private fun ceilDiv(a: Long, b: Long): Long = (a + b - 1) / b
    }
}
