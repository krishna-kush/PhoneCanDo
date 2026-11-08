package com.phonecando.lre.image.family

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily

/**
 * The one shell line that installs packages on a given OS. Pure.
 *
 * Enterprise Linux rebuilds (AlmaLinux, Rocky, CentOS) keep ripgrep and much
 * else in EPEL, which a fresh image lacks, and a package can only come from
 * EPEL once `epel-release` is installed: so EPEL goes in a step of its own,
 * first. RHEL itself and Oracle Linux name their EPEL package differently,
 * so they get the plain line.
 */
internal object InstallLine {
    private const val EPEL = "epel-release"
    private val EL_FAMILIES = setOf(PackageFamily.DNF, PackageFamily.MICRODNF, PackageFamily.YUM)
    private val NOT_EPEL_RELEASE = setOf("rhel", "ol")

    /** Packages that live in EPEL on an Enterprise Linux rebuild. */
    private val FROM_EPEL = setOf("ripgrep")

    fun of(traits: FamilyTraits, os: OsInfo, pkgs: List<String>): String {
        if (!usesEpel(traits, os) || pkgs.none { it == EPEL || it in FROM_EPEL }) return traits.installLine(pkgs)
        val rest = pkgs.filter { it != EPEL }
        return "${traits.install} $EPEL && ${traits.installLine(rest)}"
    }

    private fun usesEpel(traits: FamilyTraits, os: OsInfo): Boolean =
        traits.family in EL_FAMILIES && os.id !in NOT_EPEL_RELEASE &&
            (os.idLike.any { it == "rhel" || it == "centos" } || os.id == "centos")
}
