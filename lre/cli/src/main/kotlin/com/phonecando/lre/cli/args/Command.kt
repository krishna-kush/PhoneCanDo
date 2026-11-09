package com.phonecando.lre.cli.args

/** Where `setup` gets the base OS from. */
sealed interface BaseSource {
    /** An image reference, resolved for linux/arm64 and pulled with lre/oci. */
    data class Registry(val ref: String) : BaseSource

    /** A local rootfs tarball (`.tar`, `.tar.gz`, `.tar.xz`), set up as the single layer. */
    data class Tarball(val path: String) : BaseSource
}

/** The host side every image command needs (see lre/api's HostEnv). */
data class HostArgs(
    val imageDir: String,
    val libDir: String,
    /** Every spelling of the data dir; empty means the image dir's parent. */
    val dataDirs: List<String>,
)

/** One parsed command line. */
sealed interface Command {
    data object Help : Command

    data class Setup(
        val source: BaseSource,
        val host: HostArgs,
        /** Where downloaded layer blobs go; null means `blobs/` next to the image dir. */
        val blobs: String?,
        /** Free space to check against; null means the image dir's usable space. */
        val freeBytes: Long?,
        /** Commands to look for on the guest PATH afterwards (ImageSetup.checkTools). */
        val tools: List<String>,
    ) : Command

    data class Refresh(val host: HostArgs) : Command

    data class Run(
        val imageDir: String,
        /** The one command string for `$SHELL -c`. */
        val command: String,
        /** Working dir of the command; null means ours. */
        val cwd: String?,
        /** Kill the command after this many seconds (exit 124); null means no limit. */
        val timeoutSeconds: Long?,
    ) : Command

    data class Env(val imageDir: String) : Command
}
