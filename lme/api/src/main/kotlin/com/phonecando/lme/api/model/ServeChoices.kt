package com.phonecando.lme.api.model

/**
 * How the user wants one model served on this phone, kept on its record.
 * Each null, [RamShare.NORMAL] or [KvCacheChoice.AUTO] leaves that to the
 * plan; the runtime's rules bound the numbers.
 *
 * @property ramShare how much of the phone's RAM the model may take
 * @property kvCache the KV cache's size per value: as the phone needs it,
 *   full, or half (8-bit)
 * @property savedPrompts the prompts the server keeps in RAM besides the
 *   one it works on, so a chat comes back without being read again
 * @property checkpoints the context checkpoints the server keeps per slot,
 *   for a model with recurrent or sliding-window layers
 * @property threads the CPU threads it runs on
 * @property detailedLog the server's log also holds each request's cache
 *   decisions and the tokens around a prompt's first change, prompt text
 *   included
 */
data class ServeChoices(
    val ramShare: RamShare = RamShare.NORMAL,
    val kvCache: KvCacheChoice = KvCacheChoice.AUTO,
    val savedPrompts: Int? = null,
    val checkpoints: Int? = null,
    val threads: Int? = null,
    val detailedLog: Boolean = false,
) {
    init {
        require(savedPrompts == null || savedPrompts >= 0) { "no fewer than zero saved prompts" }
        require(checkpoints == null || checkpoints >= 1) { "at least one checkpoint" }
        require(threads == null || threads >= 1) { "at least one thread" }
    }

    companion object {
        val AUTO = ServeChoices()
    }
}

/** How much of the phone's RAM a model may take: about a third, a half or two thirds. */
enum class RamShare { LESS, NORMAL, MORE }

/** The KV cache's size per value: [AUTO] picks half only when the model needs it. */
enum class KvCacheChoice { AUTO, FULL, HALF }
