package com.phonecando.lre.image.support

import java.io.File

/** Synthetic rootfs trees shaped like real bases, just the parts detection looks at. */
object Distros {
    /** Debian with merged /usr: /bin -> usr/bin, apt, bash, git. */
    fun debian(root: File): Tree = Tree(root)
        .link("bin", "usr/bin").link("sbin", "usr/sbin").link("lib", "usr/lib")
        .exe("usr/bin/bash").exe("usr/bin/dash").link("usr/bin/sh", "dash")
        .exe("usr/bin/apt-get").exe("usr/bin/apt-mark").exe("usr/bin/git").exe("usr/bin/ls")
        .dir("usr/sbin").dir("etc/apt/apt.conf.d")
        .file(
            "usr/lib/os-release",
            "PRETTY_NAME=\"Debian GNU/Linux 12 (bookworm)\"\nNAME=\"Debian GNU/Linux\"\n" +
                "VERSION_ID=\"12\"\nID=debian\n",
        )
        .link("etc/os-release", "../usr/lib/os-release")
        // systemd's stub, absolute: must resolve inside the rootfs, never on the host.
        .link("etc/resolv.conf", "/run/systemd/resolve/stub-resolv.conf")

    /** Alpine: busybox with applet links, apk. */
    fun alpine(root: File): Tree = Tree(root)
        .exe("bin/busybox").link("bin/sh", "/bin/busybox").link("bin/ash", "/bin/busybox")
        .link("bin/ls", "/bin/busybox").link("usr/bin/env", "/bin/busybox")
        .exe("sbin/apk")
        .file("etc/apk/world", "alpine-baselayout\nbusybox\napk-tools\n")
        .file("etc/os-release", "NAME=\"Alpine Linux\"\nID=alpine\nVERSION_ID=3.22.2\nPRETTY_NAME=\"Alpine Linux v3.22\"\n")

    /** Fedora minimal: only microdnf, merged /usr. */
    fun fedoraMinimal(root: File): Tree = Tree(root)
        .link("bin", "usr/bin").link("sbin", "usr/sbin")
        .exe("usr/bin/bash").link("usr/bin/sh", "bash").exe("usr/bin/microdnf")
        .dir("usr/sbin")
        .file("etc/os-release", "NAME=\"Fedora Linux\"\nVERSION_ID=42\nID=fedora\nPRETTY_NAME=\"Fedora Linux 42 (Container Image)\"\n")

    /** Arch: pacman with a pacman 7 config. */
    fun arch(root: File): Tree = Tree(root)
        .link("bin", "usr/bin").link("sbin", "usr/bin")
        .exe("usr/bin/bash").link("usr/bin/sh", "bash").exe("usr/bin/pacman").exe("usr/bin/git").exe("usr/bin/rg")
        .file("etc/pacman.conf", "[options]\nHoldPkg = pacman glibc\nDownloadUser = alpm\n#DisableSandbox\n\n[core]\nInclude = /etc/pacman.d/mirrorlist\n")
        .file("usr/lib/os-release", "NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\nID=arch\n")
        .link("etc/os-release", "../usr/lib/os-release")

    /** openSUSE Tumbleweed: zypper, ID_LIKE. */
    fun opensuse(root: File): Tree = Tree(root)
        .exe("usr/bin/bash").exe("bin/sh").exe("usr/bin/zypper")
        .file(
            "etc/os-release",
            "NAME=\"openSUSE Tumbleweed\"\nID=\"opensuse-tumbleweed\"\nID_LIKE=\"opensuse suse\"\n" +
                "VERSION_ID=\"20251101\"\nPRETTY_NAME=\"openSUSE Tumbleweed\"\n",
        )

    /** A shell but no package manager and no os-release. */
    fun bare(root: File): Tree = Tree(root).exe("bin/sh").exe("bin/cat")

    /** Files, but nothing that runs as a shell. */
    fun noShell(root: File): Tree = Tree(root).exe("bin/hello").file("etc/os-release", "ID=distroless\n")
}
