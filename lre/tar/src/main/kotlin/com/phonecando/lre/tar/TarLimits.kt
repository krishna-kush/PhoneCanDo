package com.phonecando.lre.tar

/**
 * Caps on one layer, so a hostile or broken archive fails with
 * [com.phonecando.lre.api.LreException.TooLarge] instead of filling the phone.
 */
data class TarLimits(
    /** Members of the archive, every kind counted (whiteouts and skipped ones too). */
    val maxEntries: Int = 500_000,
    /** File data written: regular files plus hard-link copies. */
    val maxTotalBytes: Long = 16L shl 30,
    val maxFileBytes: Long = 8L shl 30,
    /** UTF-8 bytes of a member name or link target. */
    val maxPathBytes: Int = 4096,
)
