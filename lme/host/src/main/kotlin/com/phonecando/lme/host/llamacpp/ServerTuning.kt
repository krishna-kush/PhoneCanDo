package com.phonecando.lme.host.llamacpp

/**
 * What a phone's plan tunes on llama-server beyond the model and its
 * context; [DEFAULT] leaves the server's own (a CI host).
 *
 * @property promptCacheMiB the prompt cache's cap (`--cache-ram`); null:
 *   the server's default
 * @property checkpoints context checkpoints per slot (`--ctx-checkpoints`);
 *   null: the server's default, for a model that gets none
 * @property kvCacheType the KV cache's type (`--cache-type-k/v`)
 * @property detailedLog the trace-level log with each slot's token diff
 *   ([LlamaCppRuntime.DETAILED_LOG_ENV]); the log then holds prompt text
 * @property slotSavePath the dir its slot is saved to and loaded from
 *   (`--slot-save-path`, chats kept on storage); null: no saving
 */
data class ServerTuning(
    val promptCacheMiB: Long? = null,
    val checkpoints: Int? = null,
    val kvCacheType: KvCacheType = KvCacheType.F16,
    val detailedLog: Boolean = false,
    val slotSavePath: String? = null,
) {
    init {
        require(promptCacheMiB == null || promptCacheMiB >= 0) { "a prompt cache of zero MiB or more" }
        require(checkpoints == null || checkpoints >= 1) { "at least one checkpoint" }
        require(slotSavePath == null || slotSavePath.startsWith("/")) { "an absolute slot dir" }
    }

    companion object {
        val DEFAULT = ServerTuning()
    }
}
