package com.phonecando.lre.cli.report

/** Our process exit codes; `run` passes the command's own code through instead. */
object ExitCode {
    const val OK = 0
    const val OTHER = 1
    const val USAGE = 2

    /** A typed LreException; stderr says `<code>: <message>` (see [ErrorCode]). */
    const val RUNTIME = 3

    /** `run --timeout` fired, as coreutils `timeout` reports it. */
    const val TIMEOUT = 124
}
