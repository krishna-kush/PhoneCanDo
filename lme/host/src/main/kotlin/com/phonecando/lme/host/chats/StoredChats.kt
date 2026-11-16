package com.phonecando.lme.host.chats

/**
 * Chats kept on storage instead of in RAM: the server saves its slot to a
 * file before another chat takes it and loads the right one back (the
 * host's go-between drives `--slot-save-path` and `/slots`). A saved chat
 * is at most one prompt's state ([com.phonecando.lme.host.ram.PromptState]);
 * on our test phone a 15,000-token chat of the 0.8B took 159 MB and came
 * back in under 0.4 s, where reading it again took 345 s. Pure.
 */
object StoredChats {
    /** The most chats kept per model; a save past it drops the oldest. */
    const val MOST = 4

    /** What we leave free on storage after a save: Android warns when it runs short, and other apps need room too. */
    const val FREE_MARGIN_BYTES = 1L shl 30

    /**
     * The chats a plan keeps on storage with [freeBytes] free there (null:
     * none can be kept: no storage for them, or saving failed), each at most
     * [chatBytes]: [MOST] when one more fits above the margin, else 0 (the
     * server then keeps its prompt cache in RAM).
     */
    fun kept(freeBytes: Long?, chatBytes: Long): Int =
        if (freeBytes != null && fits(freeBytes, chatBytes)) MOST else 0

    /** Whether one more chat of [chatBytes] leaves [FREE_MARGIN_BYTES] of [freeBytes]. */
    fun fits(freeBytes: Long, chatBytes: Long): Boolean = freeBytes - chatBytes >= FREE_MARGIN_BYTES
}
