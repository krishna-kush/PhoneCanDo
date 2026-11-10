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
 *   what is left of the phone's spare memory after [needBytes]; 0 for none
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
    /** We served less than the model was trained for, to fit this phone. */
    val reduced: Boolean get() = automatic && context < range.max
}
