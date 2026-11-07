package com.phonecando.lre.image.family

/** Where the list of packages installed by hand comes from, and how to read it. */
internal sealed interface ManualQuery {
    val format: ListFormat

    /** A guest file we read from the host side, no command needed (apk's world file). */
    data class ReadFile(val guestPath: String, override val format: ListFormat) : ManualQuery

    /** A command run in the guest through the launcher. */
    data class Run(val argv: List<String>, override val format: ListFormat) : ManualQuery
}

/** Shapes of a manual-package listing. */
internal enum class ListFormat {
    /** One name per line (also takes dnf's literal `\n` separators). */
    LINES,

    /** apk world entries: `name`, `name@tag`, `name>=1.2`. */
    APK_WORLD,

    /** zypper's `S | Repository | Name | Version | Arch` table. */
    ZYPPER_TABLE,

    /** xbps `name-version_revision` lines. */
    XBPS_PKGVER,
}
