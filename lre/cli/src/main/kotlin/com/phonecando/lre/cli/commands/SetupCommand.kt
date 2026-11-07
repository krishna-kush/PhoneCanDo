package com.phonecando.lre.cli.commands

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.cli.args.BaseSource
import com.phonecando.lre.cli.args.Command
import com.phonecando.lre.cli.base.FetchedBase
import com.phonecando.lre.cli.base.RegistryBase
import com.phonecando.lre.cli.base.TarballBase
import com.phonecando.lre.cli.host.HostPaths
import com.phonecando.lre.cli.progress.StderrSink
import com.phonecando.lre.cli.report.ExitCode
import com.phonecando.lre.cli.report.SetupJson
import com.phonecando.lre.cli.report.SetupTimings
import com.phonecando.lre.image.ImageSetup
import java.io.File
import java.io.PrintStream

/**
 * `setup`: pull (or open) the base, then ImageSetup.create, which resumes a
 * setup cut short and returns at once for a finished one. Progress goes to
 * stderr, the result JSON to stdout.
 */
class SetupCommand(private val registry: () -> RegistryBase = { RegistryBase() }) {
    fun run(command: Command.Setup, out: PrintStream, err: PrintStream): Int {
        val imageDir = HostPaths.imageDir(command.host.imageDir)
        val host = HostPaths.hostEnv(command.host, imageDir, err::println)
        val sink = StderrSink(err)

        val started = System.nanoTime()
        val fetched: FetchedBase = when (val source = command.source) {
            is BaseSource.Registry -> registry().fetch(source.ref, blobDir(command, imageDir), sink)
            is BaseSource.Tarball -> TarballBase.of(File(source.path).absoluteFile)
        }
        val fetchedAt = System.nanoTime()
        val free = command.freeBytes ?: imageDir.usableSpace
        val result = ImageSetup().create(ImageLayout(imageDir), fetched.base, host, free, sink)
        val doneAt = System.nanoTime()
        sink.finish()

        val download = if (command.source is BaseSource.Registry) millis(fetchedAt - started) else 0L
        out.println(SetupJson.render(result, fetched.info, SetupTimings(download, millis(doneAt - fetchedAt))))
        return ExitCode.OK
    }

    private fun blobDir(command: Command.Setup, imageDir: File): File =
        command.blobs?.let { File(it).absoluteFile } ?: File(imageDir.parentFile, "blobs")

    private fun millis(nanos: Long) = nanos / 1_000_000
}
