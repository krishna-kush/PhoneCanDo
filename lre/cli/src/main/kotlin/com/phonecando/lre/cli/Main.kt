package com.phonecando.lre.cli

import kotlin.system.exitProcess

/** Entry point of `cli` (installDist: lre/cli/build/install/cli/bin/cli). Usage: `cli help`. */
fun main(args: Array<String>) {
    val code = Cli.main(args.toList(), System.out, System.err)
    System.out.flush()
    exitProcess(code)
}
