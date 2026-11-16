package com.phonecando.lme.host.context

import com.phonecando.lme.host.ram.RamVerdict

/**
 * How a model is served on one phone at one moment: the context its server
 * starts with, how it keeps its state, and the RAM that takes.
 *
 * @property automatic we picked [context] ([ContextSizing]); false: the
 *   user chose it
 * @property range what may be chosen for this model
 * @property needBytes its weights, its compute buffer and one prompt's
 *   state at [context] (KV cache, recurrent state, context checkpoints:
 *   [com.phonecando.lme.host.ram.PromptState])
 * @property promptBytes one prompt's state alone: what the slot holds and
 *   what each prompt in the cache takes at most
 * @property promptCacheMiB the server's prompt cache cap (`--cache-ram`):
 *   room for the saved prompts the user wants, out of what is left of the
 *   phone's spare memory after [needBytes]; 0 for none (also while chats
 *   are kept on storage, [storedChats])
 * @property savedPrompts the saved chats that room holds (each a prompt
 *   state at half the context, [com.phonecando.lme.host.ram.RamRules.SAVED_CHAT_DIVISOR]),
 *   at most as many as wanted: the chats kept besides the one being worked
 *   on
 * @property halfKvCache its KV cache is 8-bit (q8_0), half of f16
 * @property checkpoints context checkpoints per slot; null for a model the
 *   server makes none for (no recurrent or sliding-window layers)
 * @property threads the CPU threads it runs on
 * @property freeMemoryLimits the memory free now, not the RAM share, keeps
 *   it from a larger context or more saved chats: with its whole share
 *   free it would get more
 * @property ram the gate's verdict on [needBytes]
 * @property mappedBytes the weights read in place from the model's files
 *   (pages Android counts as free to reclaim); the rest of [totalBytes] is
 *   taken from free memory ([heldBytes])
 * @property computeBytes the compute buffer at [context]
 * @property measured the weights and compute buffer are the server's own
 *   count on this phone ([com.phonecando.lme.api.serve.MeasuredMemory]);
 *   false: an estimate ([com.phonecando.lme.host.ram.ServerMemory])
 * @property storedChats the chats kept on storage, at most
 *   ([com.phonecando.lme.host.chats.StoredChats]); 0: they stay in RAM
 *   ([savedPrompts])
 */
data class ContextPlan(
    val context: Long,
    val automatic: Boolean,
    val range: ContextRange,
    val needBytes: Long,
    val promptBytes: Long,
    val promptCacheMiB: Long,
    val savedPrompts: Int,
    val halfKvCache: Boolean,
    val checkpoints: Int?,
    val threads: Int,
    val freeMemoryLimits: Boolean,
    val ram: RamVerdict,
    val mappedBytes: Long,
    val computeBytes: Long,
    val measured: Boolean,
    val storedChats: Int,
) {
    /** We served less than the model was trained for: what this phone can spare, or our 64k cap ([ContextSizing.AUTO_MOST]). */
    val reduced: Boolean get() = automatic && context < range.max

    /** What the server holds once its prompt cache fills: [needBytes] plus [promptCacheMiB]. */
    val totalBytes: Long get() = needBytes + promptCacheMiB * (1L shl 20)

    /** What the server takes from free memory: [totalBytes] less the file pages it reads in place. */
    val heldBytes: Long get() = totalBytes - mappedBytes
}
