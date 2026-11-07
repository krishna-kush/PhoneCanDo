package com.phonecando.lre.cli

import com.phonecando.lre.api.LreException
import com.phonecando.lre.cli.args.ArgParser
import com.phonecando.lre.cli.args.Command
import com.phonecando.lre.cli.args.Usage
import com.phonecando.lre.cli.args.UsageError
import com.phonecando.lre.cli.commands.EnvCommand
import com.phonecando.lre.cli.commands.RefreshCommand
import com.phonecando.lre.cli.commands.RunCommand
import com.phonecando.lre.cli.commands.SetupCommand
import com.phonecando.lre.cli.report.ErrorCode
import com.phonecando.lre.cli.report.ExitCode
import java.io.PrintStream

/** Parses, dispatches and maps every failure to our exit codes (see [ExitCode]). */
object Cli {
    fun main(args: List<String>, out: PrintStream, err: PrintStream): Int =
        guarded(err) { dispatch(ArgParser.parse(args), out, err) }

    /** Runs [block]; a [UsageError] is 2, an [LreException] 3 (`<code>: <message>`), anything else 1. */
    fun guarded(err: PrintStream, block: () -> Int): Int = try {
        block()
    } catch (e: UsageError) {
        err.println("lre-cli: ${e.message}")
        err.println("run `cli help` for usage")
        ExitCode.USAGE
    } catch (e: LreException) {
        err.println(ErrorCode.line(e))
        e.cause?.let { err.println("  caused by: $it") }
        ExitCode.RUNTIME
    } catch (e: Exception) {
        err.println("lre-cli: ${e.javaClass.simpleName}: ${e.message}")
        err.println(e.stackTraceToString())
        ExitCode.OTHER
    }

    private fun dispatch(command: Command, out: PrintStream, err: PrintStream): Int = when (command) {
        Command.Help -> {
            out.println(Usage.TEXT)
            ExitCode.OK
        }
        is Command.Setup -> SetupCommand().run(command, out, err)
        is Command.Refresh -> RefreshCommand().run(command, out, err)
        is Command.Run -> RunCommand().run(command, err)
        is Command.Env -> EnvCommand().run(command, out)
    }
}
