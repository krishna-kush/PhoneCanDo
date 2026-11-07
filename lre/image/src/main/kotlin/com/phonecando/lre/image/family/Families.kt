package com.phonecando.lre.image.family

import com.phonecando.lre.api.PackageFamily

/**
 * The one table of package-manager families, in detection order: the first
 * whose [FamilyTraits.binary] is on the guest PATH wins (Fedora ships both
 * `dnf` and a `yum` link, so dnf comes first). A family we don't list still
 * works; it just gets no install hint.
 */
internal object Families {
    /**
     * Packages for the agent's tools. All eight families name bash, git and
     * ripgrep the same today (RHEL-likes get ripgrep from EPEL); a family
     * that differs overrides it in its own row.
     */
    private val TOOLS = mapOf("bash" to "bash", "git" to "git", "rg" to "ripgrep")

    private fun dnfQuery(binary: String) = ManualQuery.Run(
        listOf(binary, "repoquery", "--userinstalled", "--queryformat", "%{name}\\n"),
        ListFormat.LINES,
    )

    val all: List<FamilyTraits> = listOf(
        FamilyTraits(
            PackageFamily.APT, "apt-get", "apt-get install -y", "apt-get update", TOOLS,
            ManualQuery.Run(listOf("apt-mark", "showmanual"), ListFormat.LINES),
            ProotFix.APT_SANDBOX_USER,
        ),
        FamilyTraits(
            PackageFamily.APK, "apk", "apk add", null, TOOLS,
            ManualQuery.ReadFile("/etc/apk/world", ListFormat.APK_WORLD),
            null,
        ),
        FamilyTraits(PackageFamily.DNF, "dnf", "dnf install -y", null, TOOLS, dnfQuery("dnf"), null),
        FamilyTraits(PackageFamily.MICRODNF, "microdnf", "microdnf install -y", null, TOOLS, null, null),
        FamilyTraits(PackageFamily.YUM, "yum", "yum install -y", null, TOOLS, dnfQuery("yum"), null),
        FamilyTraits(
            PackageFamily.PACMAN, "pacman", "pacman -S --noconfirm", "pacman -Sy", TOOLS,
            ManualQuery.Run(listOf("pacman", "-Qqe"), ListFormat.LINES),
            ProotFix.PACMAN_SANDBOX,
        ),
        FamilyTraits(
            PackageFamily.ZYPPER, "zypper", "zypper install -y", null, TOOLS,
            ManualQuery.Run(
                listOf("zypper", "--quiet", "--non-interactive", "packages", "--userinstalled"),
                ListFormat.ZYPPER_TABLE,
            ),
            null,
        ),
        FamilyTraits(
            PackageFamily.XBPS, "xbps-install", "xbps-install -y", "xbps-install -S", TOOLS,
            ManualQuery.Run(listOf("xbps-query", "-m"), ListFormat.XBPS_PKGVER),
            null,
        ),
    )

    fun of(family: PackageFamily): FamilyTraits = all.first { it.family == family }
}
