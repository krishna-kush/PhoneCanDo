package com.phonecando.agents.kit.cli

import kotlin.system.exitProcess

/** Entry point of `kit-cli` (installDist: agents/kit/kotlin/cli/build/install/kit-cli/bin/kit-cli). Usage: `kit-cli help`. */
fun main(args: Array<String>) {
  val code = Cli.main(args.toList(), System.out, System.err)
  System.out.flush()
  exitProcess(code)
}
