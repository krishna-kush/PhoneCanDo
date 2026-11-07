package com.phonecando.lre.image.setup

/** The steps that turn a base into a Linux image, in order; each one idempotent. */
enum class SetupStep(val id: String) {
    /** Enough free space for the unpacked base. */
    SPACE("space"),

    /** Every layer into rootfs/, starting from an empty one. */
    UNPACK("unpack"),

    /** OS, package manager and shell, recorded in run/image.properties. */
    DETECT("detect"),

    /** DNS, hosts, hostname, the package manager's proot fix. */
    FIXUPS("fixups"),

    /** One shims/ link per guest command. */
    SHIMS("shims"),

    /** home/, tmp/, logs/, run/ dirs, fake /proc, engine.env, launch.conf, os-note.md. */
    SEED("seed"),
}
