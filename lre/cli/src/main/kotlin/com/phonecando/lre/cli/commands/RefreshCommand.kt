package com.phonecando.lre.cli.commands

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.cli.args.Command
import com.phonecando.lre.cli.host.HostPaths
import com.phonecando.lre.cli.report.ExitCode
import com.phonecando.lre.cli.report.RefreshJson
import com.phonecando.lre.image.ImageSetup
import java.io.PrintStream

/** `refresh`: ImageSetup.refreshForStart, as the app runs it before every engine start (shims re-scanned too). */
class RefreshCommand {
    fun run(command: Command.Refresh, out: PrintStream, err: PrintStream): Int {
        val imageDir = HostPaths.existingImageDir(command.host.imageDir)
        val host = HostPaths.hostEnv(command.host, imageDir, err::println)
        val started = System.nanoTime()
        ImageSetup.refreshForStart(ImageLayout(imageDir), host)
        out.println(RefreshJson.render(imageDir.path, (System.nanoTime() - started) / 1_000_000))
        return ExitCode.OK
    }
}
