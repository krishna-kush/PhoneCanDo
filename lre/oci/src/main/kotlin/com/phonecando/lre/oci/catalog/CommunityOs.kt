package com.phonecando.lre.oci.catalog

/**
 * Community operating systems: distributions that their own project (or a
 * known maintainer) publishes on Docker Hub outside its official library,
 * each checked for a linux/arm64 build (2026-11-11). The picker shows them
 * before the rest of the unofficial ones ([UnofficialOs]): by pulls alone
 * they would drown, since outside the official badge Hub's "Operating
 * systems" category is mostly desktops, JDKs and CI images.
 */
internal object CommunityOs {
    /** A pull name and what we say of it when Docker Hub has no description. */
    data class Entry(val name: String, val blurb: String)

    val CURATED: List<Entry> = listOf(
        Entry("kalilinux/kali-rolling", "Kali Linux: Debian-based, for security testing"),
        Entry("parrotsec/core", "Parrot OS: Debian-based, for security and privacy"),
        Entry("opensuse/tumbleweed", "openSUSE Tumbleweed, the rolling release"),
        Entry("opensuse/leap", "openSUSE Leap, the regular release"),
        Entry("menci/archlinuxarm", "Arch Linux ARM"),
        Entry("manjarolinux/base", "Manjaro: Arch-based"),
        Entry("gentoo/stage3", "Gentoo stage3: everything built from source"),
        Entry("nixos/nix", "The Nix package manager on a small base"),
        Entry("chainguard/wolfi-base", "Wolfi: a small glibc distribution"),
        Entry("openeuler/openeuler", "openEuler"),
        Entry("chimeralinux/chimera", "Chimera Linux: a FreeBSD userland on musl"),
        Entry("openmandriva/cooker", "OpenMandriva Lx, the development branch"),
        Entry("aclemons/slackware", "Slackware Linux, community builds"),
        Entry("bitnami/minideb", "A minimal Debian"),
    )

    /**
     * [entry] as a picker row from a Hub search for its name: Hub's words,
     * pulls and logo when the search lists it, else the list's own words.
     * Null when Hub lists it archived or without arm64 (it changed since we
     * checked).
     */
    fun pick(entry: Entry, page: SearchPage): CatalogImage? {
        val hit = page.results.firstOrNull { it.id == entry.name }
            ?: return fallback(entry)
        if (hit.archived) return null
        if (hit.architectures.isNotEmpty() && hit.architectures.none { it.name == "arm64" }) return null
        return CatalogImage(
            name = entry.name,
            description = hit.shortDescription?.trim()?.takeIf { it.isNotEmpty() } ?: entry.blurb,
            pullCount = hit.rawPullCount,
            logoUrl = hit.logoUrl?.https(),
        )
    }

    /** The row when Hub could not be asked: the list's words, no pulls, no logo. */
    fun fallback(entry: Entry): CatalogImage = CatalogImage(entry.name, entry.blurb, pullCount = null, logoUrl = null)
}
