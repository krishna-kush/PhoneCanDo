package com.phonecando.lre.cli.args

/** The help text. */
object Usage {
    val TEXT = """
        |lre-cli: our image download and setup (lre/oci, lre/image) on a plain JVM, for CI.
        |
        |  cli setup (--ref <image ref> | --tarball <rootfs.tar[.gz|.xz]>)
        |            --image-dir <dir> --lib-dir <dir>
        |            [--data-dir <path>]... [--blobs <dir>] [--free-bytes <n>]
        |      Pulls the linux/arm64 image (or takes the tarball as its one layer) and runs
        |      ImageSetup.create, resuming a setup cut short. Prints one JSON line:
        |      os, missingTools, installCommand, socketPathTight, source, timingsMs.
        |  cli refresh --image-dir <dir> --lib-dir <dir> [--data-dir <path>]...
        |      ImageSetup.refreshForStart, as the app runs it before every engine start.
        |  cli run --image-dir <dir> [--cwd <dir>] [--timeout <seconds>] -- <command>...
        |      Runs `${'$'}SHELL -c "<command>"` with run/engine.env over our environment, as
        |      opencode runs a command; the words after -- form the one command string.
        |      Exits with the command's code (124 on timeout).
        |  cli env --image-dir <dir>
        |      Prints run/engine.env as shell `export` lines, for `eval` in a script.
        |
        |  --lib-dir   holds libproot.so, libproot-loader.so and libphonecando_launch.so
        |  --data-dir  every spelling of the data dir (default: the image dir's parent)
        |  --blobs     downloaded layers (default: blobs/ next to the image dir)
        |
        |Exit codes: 0 ok, 1 other failure, 2 usage, 3 runtime error (`<code>: <message>`
        |on stderr, code = the LreException subclass in snake_case, e.g. no_arm64).
    """.trimMargin()
}
