package com.phonecando.lre.image

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.image.conf.SocketBudget
import com.phonecando.lre.image.delete.TreeDeleter
import com.phonecando.lre.image.detect.Detector
import com.phonecando.lre.image.fixup.Fixups
import com.phonecando.lre.image.fixup.HostnameFiles
import com.phonecando.lre.image.record.ImageRecord
import com.phonecando.lre.image.record.RecordStore
import com.phonecando.lre.image.setup.Seeder
import com.phonecando.lre.image.setup.SetupState
import com.phonecando.lre.image.setup.SetupStep
import com.phonecando.lre.image.setup.SpaceCheck
import com.phonecando.lre.image.setup.StartRefresh
import com.phonecando.lre.image.setup.TarUnpacker
import com.phonecando.lre.image.setup.Unpacker
import com.phonecando.lre.image.setup.unpackAll
import com.phonecando.lre.image.shim.Shims
import com.phonecando.lre.image.tools.MissingTools
import com.phonecando.lre.image.tools.ToolsCheck
import com.phonecando.network.CancelSignal
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import java.io.IOException
import java.nio.file.Files

/**
 * Turns a base OS into a working image at an [ImageLayout], or sets up an
 * image with no Linux. Every step is idempotent and recorded in
 * `run/setup-state`, so a failed or killed [create] resumes at the step that
 * failed; an interrupted unpack starts again from an empty rootfs.
 */
class ImageSetup internal constructor(
    private val unpacker: Unpacker,
    private val beforeStep: (SetupStep) -> Unit,
) {
    constructor(unpacker: Unpacker = TarUnpacker()) : this(unpacker, {})

    /**
     * Runs (or resumes) [SetupStep.entries] for [base]. [freeBytes] is the
     * free space where [layout] lives; see [SpaceCheck.estimate].
     *
     * @throws LreException.NoSpace when [freeBytes] is short of the estimate.
     * @throws LreException.NoShell when the base has no shell.
     * @throws LreException.Cancelled when [cancel] fires.
     * @throws IOException on disk errors; the unpacker's own LreExceptions pass through.
     */
    fun create(
        layout: ImageLayout,
        base: BaseImage,
        host: HostEnv,
        freeBytes: Long,
        sink: ProgressSink = ProgressSink.NONE,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): SetupResult {
        Files.createDirectories(layout.run.toPath())
        val done = SetupState.done(layout)
        for (step in SetupStep.entries) {
            if (step in done) continue
            if (cancel.isCancelled()) throw LreException.Cancelled()
            sink.report(Progress(step.id, step.ordinal.toLong(), SetupStep.entries.size.toLong()))
            beforeStep(step)
            run(step, layout, base, host, freeBytes, sink, cancel)
            SetupState.markDone(layout, step)
        }
        return SetupResult(StartRefresh.recorded(layout).os, SocketBudget.isTight(layout, host))
    }

    private fun run(
        step: SetupStep,
        layout: ImageLayout,
        base: BaseImage,
        host: HostEnv,
        freeBytes: Long,
        sink: ProgressSink,
        cancel: CancelSignal,
    ) {
        when (step) {
            SetupStep.SPACE -> SpaceCheck.require(SpaceCheck.estimate(base), freeBytes)
            SetupStep.UNPACK -> {
                if (!TreeDeleter().delete(layout.rootfs)) throw IOException("could not clear ${layout.rootfs}")
                Files.createDirectories(layout.rootfs.toPath())
                unpacker.unpackAll(base, layout.rootfs, sink, cancel)
            }
            SetupStep.DETECT -> {
                val detection = Detector().detect(layout.rootfs, base.config)
                RecordStore.save(layout, ImageRecord.Linux(detection))
            }
            SetupStep.FIXUPS -> Fixups().apply(layout.rootfs, StartRefresh.recorded(layout), host)
            SetupStep.SHIMS -> Shims().refresh(layout, host, StartRefresh.recorded(layout).guestPath)
            SetupStep.SEED -> {
                val detection = StartRefresh.recorded(layout)
                Seeder.linuxDirs(layout)
                Seeder.linuxFiles(layout, host, detection, HostnameFiles.refresh(layout, detection.os))
            }
        }
    }

    companion object {
        /**
         * An image with no Linux (the play channel, or "continue without
         * Linux"): home/, tmp/, logs/ and an engine.env with HOME and TMPDIR.
         * A rootfs already there is left alone; [create] can add Linux later
         * and keeps home/.
         */
        fun android(layout: ImageLayout, host: HostEnv): SetupResult {
            Seeder.androidDirs(layout)
            Seeder.androidFiles(layout)
            RecordStore.save(layout, ImageRecord.Android)
            SetupState.markAndroid(layout)
            return SetupResult(null, SocketBudget.isTight(layout, host))
        }

        /**
         * Before every engine start: finishes a reset a kill cut short and
         * rewrites what depends on the phone (DNS, shims, launch.conf,
         * engine.env, fake /proc) and the hostname (the OS's name unless
         * someone wrote their own into /etc/hostname). Cheap when nothing
         * changed.
         *
         * [guestUnset] names the variables (a trailing `*` for a prefix) no
         * guest command may inherit, on top of `LD_*`: the secrets the host's
         * engine holds. launch.conf keeps the list of the last refresh.
         *
         * @throws LreException.NotFound when setup never finished.
         * @throws LreException.UnsafeEntry for a name that is not a variable name or prefix.
         */
        fun refreshForStart(layout: ImageLayout, host: HostEnv, guestUnset: List<String> = emptyList()) =
            StartRefresh.beforeStart(layout, host, guestUnset)

        /**
         * Which of [commands] the guest PATH of the image at [layout] lacks,
         * and one line that installs them with its package manager. Cheap
         * file checks. An image with no Linux lacks nothing we could install.
         *
         * @throws LreException.NotFound when setup never finished.
         * @throws LreException.UnsafeEntry for a command that is not a plain name.
         */
        fun checkTools(layout: ImageLayout, commands: List<String>): MissingTools = ToolsCheck.ofImage(layout, commands)

        /** True when [create] or [android] finished for [layout]. */
        fun isReady(layout: ImageLayout): Boolean = SetupState.isReady(layout)
    }
}
