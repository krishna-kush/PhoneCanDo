package com.phonecando.lre.cli.commands

import com.phonecando.lre.cli.args.Command
import com.phonecando.lre.cli.engine.EngineEnvFile
import com.phonecando.lre.cli.engine.EngineEnvs
import com.phonecando.lre.cli.host.HostPaths
import com.phonecando.lre.cli.report.ExitCode
import java.io.PrintStream

/** `env`: run/engine.env as `export` lines, so a script can `eval` it and skip a JVM per command. */
class EnvCommand {
    fun run(command: Command.Env, out: PrintStream): Int {
        out.print(EngineEnvFile.exports(EngineEnvs.linux(HostPaths.existingImageDir(command.imageDir))))
        return ExitCode.OK
    }
}
