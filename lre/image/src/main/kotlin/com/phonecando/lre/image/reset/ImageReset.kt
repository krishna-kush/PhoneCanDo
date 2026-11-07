package com.phonecando.lre.image.reset

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.image.ImageSetup
import com.phonecando.lre.image.delete.TreeDeleter
import com.phonecando.lre.image.detect.Detector
import com.phonecando.lre.image.family.Families
import com.phonecando.lre.image.family.ManualQuery
import com.phonecando.lre.image.family.PackageLists
import com.phonecando.lre.image.files.TextFiles
import com.phonecando.lre.image.fixup.Fixups
import com.phonecando.lre.image.guest.GuestFs
import com.phonecando.lre.image.record.ImageRecord
import com.phonecando.lre.image.record.RecordStore
import com.phonecando.lre.image.setup.Seeder
import com.phonecando.lre.image.setup.SpaceCheck
import com.phonecando.lre.image.setup.StartRefresh
import com.phonecando.lre.image.setup.TarUnpacker
import com.phonecando.lre.image.setup.Unpacker
import com.phonecando.lre.image.setup.unpackAll
import com.phonecando.lre.image.shim.Shims
import java.io.IOException
import java.nio.file.Files

/**
 * Resets a Linux image to a fresh copy of its base and keeps home/: the new
 * rootfs is unpacked next to the old one, swapped in by rename and the old
 * one deleted, so a failure or kill before the swap leaves the image as it
 * was. Packages installed by hand are listed first (through [runner] or a
 * guest file) and written to run/reinstall.txt; once the fresh rootfs is in,
 * the same query there drops what the base itself marks as installed by
 * hand (a baked image installs its tools that way), so only what the user
 * added is offered again.
 */
class ImageReset(
    private val runner: GuestRunner,
    private val unpacker: Unpacker = TarUnpacker(),
) {
    /**
     * @throws LreException.NotFound when [layout] holds no ready Linux image,
     *   plus [ImageSetup.create]'s errors for the new rootfs.
     */
    fun reset(
        layout: ImageLayout,
        base: BaseImage,
        host: HostEnv,
        freeBytes: Long,
        sink: ProgressSink = ProgressSink.NONE,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): ResetResult {
        val swap = RootfsSwap()
        if (swap.recover(layout)) StartRefresh.redetect(layout, host)
        val record = RecordStore.load(layout) as? ImageRecord.Linux
        if (record == null || !ImageSetup.isReady(layout)) throw LreException.NotFound("a Linux image at ${layout.root}")
        SpaceCheck.require(SpaceCheck.estimate(base), freeBytes)

        sink.report(Progress("packages", 0, null))
        val packages = record.detection.os.family?.let { Families.of(it).manualQuery }
            ?.let { manualPackages(layout, it) }.orEmpty()

        sink.report(Progress("unpack", 0, null))
        val fresh = swap.newRoot(layout)
        if (!TreeDeleter().delete(fresh)) throw IOException("could not clear $fresh")
        Files.createDirectories(fresh.toPath())
        unpacker.unpackAll(base, fresh, sink, cancel)
        val detection = Detector().detect(fresh, base.config)
        Fixups().apply(fresh, detection, host)
        if (cancel.isCancelled()) throw LreException.Cancelled()

        sink.report(Progress("swap", 0, null))
        val family = detection.os.family?.let(Families::of)
        val listed = family?.takeIf { packages.isNotEmpty() }?.let { ReinstallList(it.installLine(packages), packages) }
        // Written with the swap, so a kill after it still leaves an offer.
        swap.swap(layout, listed)
        RecordStore.save(layout, ImageRecord.Linux(detection))
        Seeder.linuxDirs(layout)
        Shims().refresh(layout, host, detection.guestPath)
        Seeder.linuxFiles(layout, host, detection)

        val reinstall = if (listed != null && family != null) {
            userOnly(layout, family.manualQuery, listed, family::installLine)
        } else {
            listed
        }
        val result = ImageSetup.linuxResult(layout, host, detection)
        return ResetResult(detection.os, result.missingTools, result.installCommand, reinstall)
    }

    /**
     * [listed] without what the fresh base itself marks as installed by hand,
     * written over run/reinstall.txt (or removing it when nothing is left).
     * When the fresh base cannot be asked, [listed] stands.
     */
    private fun userOnly(
        layout: ImageLayout,
        query: ManualQuery?,
        listed: ReinstallList,
        installLine: (List<String>) -> String,
    ): ReinstallList? {
        val base = query?.let { manualPackagesOrNull(layout, it) } ?: return listed
        val user = listed.packages.filter { it !in base }
        if (user == listed.packages) return listed
        if (user.isEmpty()) {
            ReinstallList.clear(layout)
            return null
        }
        return ReinstallList(installLine(user), user).also { TextFiles.write(ReinstallList.file(layout), it.encode()) }
    }

    /** The hand-installed packages, or none when the query fails: a reset never stops for this list. */
    private fun manualPackages(layout: ImageLayout, query: ManualQuery): List<String> =
        manualPackagesOrNull(layout, query).orEmpty()

    /** The hand-installed packages, or null when the query fails. */
    private fun manualPackagesOrNull(layout: ImageLayout, query: ManualQuery): List<String>? {
        val text = try {
            when (query) {
                is ManualQuery.ReadFile -> GuestFs(layout.rootfs).resolve(query.guestPath)?.let { TextFiles.read(it) }
                is ManualQuery.Run -> runner.run(layout, query.argv).takeIf { it.exitCode == 0 }?.stdout
            }
        } catch (e: LreException.Cancelled) {
            throw e
        } catch (_: Exception) {
            null
        }
        return text?.let { PackageLists.parse(query.format, it) }
    }
}
