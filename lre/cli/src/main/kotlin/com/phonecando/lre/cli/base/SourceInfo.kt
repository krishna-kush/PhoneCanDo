package com.phonecando.lre.cli.base

import com.phonecando.lre.api.BaseImage

/** Where a base came from, for the setup report. */
sealed interface SourceInfo {
    /** A registry image: [ref] canonical, [manifestDigest] the linux/arm64 manifest set up. */
    data class Registry(
        val ref: String,
        val manifestDigest: String,
        val layers: Int,
        val bytes: Long,
        /** Registry host that served the manifest (a mirror when Docker Hub refused). */
        val sourceHost: String,
    ) : SourceInfo

    data class Tarball(val path: String, val bytes: Long) : SourceInfo
}

/** A base ready for ImageSetup, and where it came from. */
data class FetchedBase(val base: BaseImage, val info: SourceInfo)
