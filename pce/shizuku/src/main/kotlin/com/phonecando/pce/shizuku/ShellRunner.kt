package com.phonecando.pce.shizuku

import com.phonecando.pce.api.PceResult

/** Result of one privileged shell command. */
data class ShellOutput(
    val exitCode: Int,
    val stdout: String = "",
    val stderr: String = "",
)

/**
 * Host-only privileged command boundary.
 *
 * The PCE never exposes a raw shell action to an AI. A host may use this
 * primitive for device operations, but must keep the command set under its own
 * policy and validation.
 */
fun interface ShellRunner {
    suspend fun run(command: String): PceResult<ShellOutput>
}
