package com.phonecando.lre.oci.manifest

import com.phonecando.lre.api.ImageConfig

/** The runtime part of a config blob; empty strings mean "not set". */
internal fun ConfigDoc.toImageConfig(): ImageConfig {
    val runtime = config ?: RuntimeDoc()
    return ImageConfig(
        env = runtime.env.orEmpty(),
        workingDir = runtime.workingDir?.takeIf { it.isNotEmpty() },
        user = runtime.user?.takeIf { it.isNotEmpty() },
        entrypoint = runtime.entrypoint.orEmpty(),
        cmd = runtime.cmd.orEmpty(),
    )
}

/**
 * Whether the config says linux/arm64. When an index already chose the
 * platform ([platformChosen]) a config without an architecture passes; a
 * single-arch manifest must state arm64.
 */
internal fun ConfigDoc.isArm64(platformChosen: Boolean): Boolean {
    if (platformChosen && architecture == null) return true
    return Arm64.matches(os ?: if (platformChosen) "linux" else null, architecture, variant)
}
