package com.phonecando.lre.image.proc

/**
 * What the guest's uname(2) says, through proot's --kernel-release in its
 * full form, `\sysname\nodename\release\version\machine\domainname\hwcap\`
 * (proot's kompat.c; the short form keeps the phone's own nodename,
 * `localhost`). Release and version are ours, as in /proc/version;
 * [machine] is the host's real one; hwcap -1 leaves the host's as it is.
 */
internal data class Uname(val nodename: String, val machine: String) {
    fun prootArg(): String =
        "--kernel-release=\\Linux\\$nodename\\${FakeProc.KERNEL_RELEASE}\\${FakeProc.KERNEL_VERSION}" +
            "\\$machine\\(none)\\-1\\"

    companion object {
        /** `uname -m` from a JVM's os.arch: ART reports the kernel's own; HotSpot calls x86_64 amd64. Pure. */
        fun machine(osArch: String): String = if (osArch == "amd64") "x86_64" else osArch

        /** This host's machine. */
        fun hostMachine(): String = machine(System.getProperty("os.arch").orEmpty())
    }
}
