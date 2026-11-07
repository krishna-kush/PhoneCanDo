package com.phonecando.lre.image.family

import com.phonecando.lre.api.PackageFamily

/** What we need to know about one package manager. */
internal data class FamilyTraits(
    val family: PackageFamily,
    /** The binary whose presence on the guest PATH identifies the family. */
    val binary: String,
    /** Install command, packages appended, e.g. `apt-get install -y`. */
    val install: String,
    /** Run before [install] when a fresh image has no package index, e.g. `apt-get update`. */
    val refresh: String?,
    /** Package per agent tool command: `rg` -> `ripgrep`. */
    val packages: Map<String, String>,
    /** How to list what was installed by hand, for reset; null when the family has no such query. */
    val manualQuery: ManualQuery?,
    /** What the package manager needs to work under proot; null when nothing. */
    val prootFix: ProotFix?,
) {
    /** One shell line that installs [pkgs], the refresh step included. */
    fun installLine(pkgs: List<String>): String =
        listOfNotNull(refresh, "$install ${pkgs.joinToString(" ")}").joinToString(" && ")

    /** The install line with a `<pkg>` placeholder, for os-note.md. */
    val installHint: String get() = installLine(listOf("<pkg>"))

    fun packageFor(tool: String): String = packages[tool] ?: tool
}

/** A proot workaround one family needs. */
internal enum class ProotFix {
    /** apt drops to the `_apt` user for downloads, which proot cannot do: stay root. */
    APT_SANDBOX_USER,

    /** pacman 7 sandboxes downloads with Landlock and seccomp, which proot lacks. */
    PACMAN_SANDBOX,
}
