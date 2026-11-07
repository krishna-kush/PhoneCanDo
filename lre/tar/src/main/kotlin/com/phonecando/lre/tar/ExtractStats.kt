package com.phonecando.lre.tar

/** What one layer did to the guest root. */
data class ExtractStats(
    val files: Int,
    val dirs: Int,
    val symlinks: Int,
    /** Hard links, written as copies of their target (apps may not create hard links). */
    val hardlinksCopied: Int,
    /** OCI whiteout markers applied (`.wh.<name>` and opaque dirs). */
    val whiteouts: Int,
    /** Device nodes, FIFOs, unknown member types and aufs metadata we don't create. */
    val skipped: Int,
    /** File data written: regular files plus hard-link copies. */
    val bytes: Long,
)
