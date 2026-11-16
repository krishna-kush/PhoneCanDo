package com.phonecando.lme.host.ram

import com.phonecando.lme.api.model.RamShare

/**
 * Every number the RAM gate uses, in one place (the table in
 * `RamGateTest` pins them):
 *
 * - local models are offered from a 6 GB phone up, with a warning below 8 GB
 * - a model may take at most a share of the phone's RAM (the budget): half
 *   by default, about a third or two thirds when the user picks Less or More
 *   ([percent]); never what the runner's memory guard keeps free. It counts
 *   its weights (the file pages read in place and the copies in the CPU's
 *   own layouts, [ServerMemory]: the server's own count once measured, else
 *   an estimate), its compute buffer, and one prompt's state at the planned
 *   context (its KV cache, the recurrent state of one sequence, and its
 *   context checkpoints); the rest is Android's, the agent's and the other
 *   apps'
 * - what it may take at a start, its prompt cache included, is also bounded
 *   by the memory free then (`MemoryInfo.availMem`) less what we keep free:
 *   [KEEP_FREE_PERCENT] of the total, where the runner's memory guard is
 *   back at ok (its warning line, 12%, plus 4% it waits for), and
 *   [FREE_MARGIN_MIB] for the agent's own engine. So a model never starts
 *   the guard's countdown by itself. That bound sizes the automatic context
 *   and the server's prompt cache, never a verdict
 * - the prompt cache has room for [CACHED_PROMPTS] whole prompt states
 *   besides the slot's, and the automatic context keeps that room before it
 *   grows past 32k; a saved chat counts as a state at half the context
 *   ([SAVED_CHAT_DIVISOR]). While chats are kept on storage instead
 *   ([com.phonecando.lme.host.chats.StoredChats]) there is no prompt cache
 * - a context the user chose may pass the budget (with a warning), never
 *   the phone's total RAM
 *
 * Phones are sold by marketed size (8 GB) but report less as total RAM
 * (7.2 GiB on our 8 GB test phone: the kernel and firmware keep some), so
 * the floor and the warning compare the marketed size ([RamClass]); the
 * budget uses the real total.
 */
object RamRules {
    const val OFFERED_FROM_GB = 6
    const val WARN_BELOW_GB = 8
    const val BUDGET_PERCENT = 50
    const val LESS_PERCENT = 33
    const val MORE_PERCENT = 66
    const val KEEP_FREE_PERCENT = 16
    const val FREE_MARGIN_MIB = 512L

    /** The budget's share of the phone's RAM for [share]. */
    fun percent(share: RamShare): Int = when (share) {
        RamShare.LESS -> LESS_PERCENT
        RamShare.NORMAL -> BUDGET_PERCENT
        RamShare.MORE -> MORE_PERCENT
    }

    /**
     * The context checkpoints a server keeps per slot (`--ctx-checkpoints`)
     * for a model with recurrent or sliding-window layers, which cannot roll
     * back to an earlier token: each holds the recurrent state and the
     * window's KV cache. Enough for the next turn of the same chat (the
     * server makes two just before a prompt's end and one at its last user
     * message); the pinned server's default, 32, can take more than a 4B
     * model's KV cache. The user may pick any in [CHECKPOINTS_RANGE].
     */
    const val CONTEXT_CHECKPOINTS = 4
    val CHECKPOINTS_RANGE = 2..8

    /**
     * The prompt states the prompt cache (`--cache-ram`) has room for
     * besides the slot's: two, so the agent's chat and one other (a
     * sub-agent's, a title request's) each come back without being read
     * again while the other takes the one slot. The user may pick any in
     * [CACHED_PROMPTS_RANGE]; 0 turns the cache off.
     */
    const val CACHED_PROMPTS = 2
    val CACHED_PROMPTS_RANGE = 0..3

    /**
     * What one saved chat counts as where room is short (the half-size
     * notes rule, and how many chats a cache holds): one prompt state at
     * 1/[SAVED_CHAT_DIVISOR] of the context. A working agent's chat is
     * usually well short of the whole context (Claude Code's runs 13-20k
     * tokens of a 32k one), and the server skips a saved prompt bigger than
     * the whole cache, so a cache under one such state saves no chat.
     */
    const val SAVED_CHAT_DIVISOR = 2L

    /**
     * Before a model's first measurement on a phone ([ServerMemory.estimated]),
     * the weights its server copies into the CPU's own layouts, as a percent
     * of its files: all of them, on top of the files' own pages. Measured on
     * our test phone (Qwen3.5 0.8B Q4_K_M, 508 MiB of files): 202 MiB read
     * in place and 549 MiB copied (KleidiAI 290 + repack 259), 1.8 times the
     * 307 MiB of layers it copied, so a copy can outgrow its file pages.
     */
    const val COPIED_WEIGHTS_PERCENT = 100L

    /**
     * Before a first measurement, the compute buffer: [COMPUTE_BASE_MIB] (or
     * a [COMPUTE_SIZE_DIVISOR]th of the files, when more) plus
     * [COMPUTE_BYTES_PER_TOKEN] per token of context. The 0.8B measured
     * 67 MiB at 32k and 195 MiB at 160k (about 1 KiB per token: the
     * attention mask's row per token for a 512-token batch).
     */
    const val COMPUTE_BASE_MIB = 64L
    const val COMPUTE_SIZE_DIVISOR = 8L
    const val COMPUTE_BYTES_PER_TOKEN = 2_048L

    /** Marketed RAM sizes in GB, smallest first. */
    val MARKETED_GB = listOf(1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 20, 24, 32, 48, 64)
}
