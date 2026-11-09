package com.phonecando.lre.image

import com.phonecando.lre.api.OsInfo

/** What a finished setup tells the UI. */
data class SetupResult(
    /** What we detected; null for an Android image (no Linux). */
    val os: OsInfo?,
    /** home/ or tmp/ leaves under 40 bytes for socket names within the 108-byte limit: suggest a shorter image id. */
    val socketPathTight: Boolean,
)
