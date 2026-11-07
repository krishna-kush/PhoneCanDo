package com.phonecando.lre.image

import com.phonecando.lre.api.OsInfo

/** What a finished setup tells the UI. */
data class SetupResult(
    /** What we detected; null for an Android image (no Linux). */
    val os: OsInfo?,
    /** Agent tools the image lacks, as commands: any of `bash`, `git`, `rg`. */
    val missingTools: List<String>,
    /** One shell line that installs [missingTools]; null when none are missing or the package manager is unknown. */
    val installCommand: String?,
    /** home/ or tmp/ leaves under 40 bytes for socket names within the 108-byte limit: suggest a shorter image id. */
    val socketPathTight: Boolean,
)
