package com.phonecando.lre.api

/** Package-manager families we know an install command and proot fix for. */
enum class PackageFamily(val id: String) {
    APT("apt"),
    APK("apk"),
    DNF("dnf"),
    YUM("yum"),
    MICRODNF("microdnf"),
    PACMAN("pacman"),
    ZYPPER("zypper"),
    XBPS("xbps"),
}

/** What we detected inside a base OS; never a hand-kept per-OS table. */
data class OsInfo(
    /** os-release ID, e.g. `debian`, `alpine`. */
    val id: String,
    val versionId: String?,
    /** os-release ID_LIKE, e.g. `rhel centos fedora`. */
    val idLike: List<String>,
    val prettyName: String?,
    /** Null when no known package manager exists; the image still works. */
    val family: PackageFamily?,
    /** Guest path of the login shell (`/bin/bash`, else `/bin/sh`); null = no shell. */
    val shell: String?,
)
