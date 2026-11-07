package com.phonecando.lre.cli.commands

import com.phonecando.lre.cli.args.Command
import com.phonecando.lre.cli.engine.EngineEnvs
import com.phonecando.lre.cli.host.HostPaths
import com.phonecando.lre.cli.report.ExitCode
import java.io.File
import java.io.PrintStream
import java.util.concurrent.TimeUnit

/**
 * `run`: one command the way opencode runs it: `$SHELL -c "<command>"`
 * (SHELL is shims/bash, so our launcher and proot) with run/engine.env
 * applied over our own environment, stdio inherited. Exits with the
 * command's code, or [ExitCode.TIMEOUT] after killing it.
 */
class RunCommand {
    fun run(command: Command.Run, err: PrintStream): Int {
        val imageDir = HostPaths.existingImageDir(command.imageDir)
        val env = EngineEnvs.linux(imageDir)
        val builder = ProcessBuilder(env.getValue("SHELL"), "-c", command.command).inheritIO()
        command.cwd?.let { builder.directory(File(it)) }
        builder.environment().putAll(env)

        val process = builder.start()
        val limit = command.timeoutSeconds ?: return process.waitFor()
        if (process.waitFor(limit, TimeUnit.SECONDS)) return process.exitValue()
        err.println("[lre-cli] timed out after ${limit}s: ${command.command}")
        process.descendants().forEach { it.destroyForcibly() }
        process.destroyForcibly().waitFor()
        return ExitCode.TIMEOUT
    }
}
