package com.phonecando.lre.api

import java.io.InputStream

enum class Compression { NONE, GZIP, XZ, ZSTD }

/** One tar layer of a base OS, applied in order (OCI whiteouts included). */
interface BaseLayer {
    val compression: Compression

    /** Bytes of the compressed stream, when known (for progress and space checks). */
    val size: Long?

    fun open(): InputStream
}

/** The runtime config a registry image ships (its Docker config). */
data class ImageConfig(
    /** `KEY=VALUE` entries, e.g. `PATH=/usr/local/sbin:...`. */
    val env: List<String>,
    val workingDir: String?,
    val user: String?,
    val entrypoint: List<String>,
    val cmd: List<String>,
)

/** A fixed base OS: the baked Default image (one layer, no config) or a registry image. */
data class BaseImage(val layers: List<BaseLayer>, val config: ImageConfig?)
