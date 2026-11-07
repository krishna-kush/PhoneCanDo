package com.phonecando.lre.image

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.image.conf.SocketBudget
import com.phonecando.lre.image.delete.TreeDeleter
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.detect.Detector
import com.phonecando.lre.image.fixup.Fixups
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
import com.phonecando.lre.image.tools.ToolsCheck
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
        return linuxResult(layout, host, StartRefresh.recorded(layout))
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
                Seeder.linuxDirs(layout)
                Seeder.linuxFiles(layout, host, StartRefresh.recorded(layout))
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
            return SetupResult(null, emptyList(), null, SocketBudget.isTight(layout, host))
        }

        /**
         * Before every engine start: finishes a reset a kill cut short and
         * rewrites what depends on the phone (DNS, shims, launch.conf,
         * engine.env, fake /proc). Cheap when nothing changed.
         *
         * @throws LreException.NotFound when setup never finished.
         */
        fun refreshForStart(layout: ImageLayout, host: HostEnv) = StartRefresh.beforeStart(layout, host)

        /** True when [create] or [android] finished for [layout]. */
        fun isReady(layout: ImageLayout): Boolean = SetupState.isReady(layout)

        internal fun linuxResult(layout: ImageLayout, host: HostEnv, detection: Detection): SetupResult {
            val tools = ToolsCheck.check(layout.rootfs, detection.guestPath, detection.os.family)
            return SetupResult(detection.os, tools.commands, tools.installCommand, SocketBudget.isTight(layout, host))
        }
    }
}
