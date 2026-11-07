package com.phonecando.lre.image.reset

import com.phonecando.lre.api.OsInfo

/** What a reset tells the UI. */
data class ResetResult(
    val os: OsInfo,
    /** Agent tools the fresh image lacks (`bash`, `git`, `rg`). */
    val missingTools: List<String>,
    /** One shell line that installs [missingTools], or null. */
    val installCommand: String?,
    /** Packages installed by hand before the reset (also in run/reinstall.txt), or null. */
    val reinstall: ReinstallList?,
)
