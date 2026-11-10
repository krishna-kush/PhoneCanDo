package com.phonecando.lme.cli

import kotlin.system.exitProcess

/** Entry point of `lme-cli` (installDist: lme/cli/build/install/lme-cli/bin/lme-cli). Usage: `lme-cli help`. */
fun main(args: Array<String>) {
    val code = Cli.main(args.toList(), System.out, System.err)
    System.out.flush()
    exitProcess(code)
}
