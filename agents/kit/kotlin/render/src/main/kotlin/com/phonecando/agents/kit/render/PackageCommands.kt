package com.phonecando.agents.kit.render

// How each package family installs packages, non-interactively, as root in
// the guest. apt, apk, pacman and xbps refresh their index first: a fresh
// image (a Docker pull) ships none, or a stale one. dnf, yum and zypper
// refresh on their own. A test keeps one entry per PackageFamilies.ALL.
internal object PackageCommands {
  /** The shell lines that install [words] (already quoted); null for a family we have no command for. */
  fun lines(family: String, words: String): List<String>? = when (family) {
    "apt" -> listOf("apt-get update", "DEBIAN_FRONTEND=noninteractive apt-get install -y $words")
    "apk" -> listOf("apk update", "apk add $words")
    "dnf", "microdnf", "yum" -> listOf("$family -y install $words")
    "pacman" -> listOf("pacman -Sy --noconfirm --needed $words")
    "zypper" -> listOf("zypper -n install $words")
    "xbps" -> listOf("xbps-install -Sy $words")
    else -> null
  }
}
