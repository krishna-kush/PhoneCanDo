package com.phonecando.lme.host.context

import com.phonecando.lme.host.ram.RamVerdict

/**
 * How a model is served on one phone at one moment: the context its server
 * starts with and the RAM that takes.
 *
 * @property automatic we picked [context] ([ContextSizing]); false: the
 *   user chose it
 * @property range what may be chosen for this model
 * @property needBytes its files plus its KV cache at [context]
 * @property promptCacheMiB the server's prompt cache cap (`--cache-ram`):
 *   what is left of the phone's spare memory after [needBytes], at most
 *   the KV cache's size; 0 for none
 * @property ram the gate's verdict on [needBytes]
 */
data class ContextPlan(
    val context: Long,
    val automatic: Boolean,
    val range: ContextRange,
    val needBytes: Long,
    val promptCacheMiB: Long,
    val ram: RamVerdict,
) {
    /** We served less than the model was trained for: what this phone can spare, or our 64k cap ([ContextSizing.AUTO_MOST]). */
    val reduced: Boolean get() = automatic && context < range.max

    /** What the server holds once its prompt cache fills: [needBytes] plus [promptCacheMiB]. */
    val totalBytes: Long get() = needBytes + promptCacheMiB * (1L shl 20)
}
