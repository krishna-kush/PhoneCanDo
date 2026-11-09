package com.phonecando.lre.image.reset

import com.phonecando.lre.api.OsInfo

/** What a reset tells the UI. */
data class ResetResult(
    val os: OsInfo,
    /** Packages installed by hand before the reset (also in run/reinstall.txt), or null. */
    val reinstall: ReinstallList?,
)
