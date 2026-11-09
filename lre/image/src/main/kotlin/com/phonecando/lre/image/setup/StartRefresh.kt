package com.phonecando.lre.image.setup

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.detect.Detector
import com.phonecando.lre.image.fixup.Fixups
import com.phonecando.lre.image.record.ImageRecord
import com.phonecando.lre.image.record.RecordStore
import com.phonecando.lre.image.reset.RootfsSwap
import com.phonecando.lre.image.shim.Shims

/** The cheap per-start work, and the re-detect a finished reset may still owe. */
internal object StartRefresh {
    /**
     * Before every engine start: finish a reset a kill cut short, detect the
     * image again (the user or the agent may have installed bash or another
     * package manager since; cheap file checks, fixups redone only on a
     * change), then rewrite what depends on the phone: DNS, shims and
     * launch.conf (the APK's lib dir moves on every update; it unsets
     * [guestUnset] too), engine.env, fake /proc.
     */
    fun beforeStart(layout: ImageLayout, host: HostEnv, guestUnset: List<String>) {
        if (RootfsSwap().recover(layout)) redetect(layout, host)
        if (!SetupState.isReady(layout)) throw LreException.NotFound("a finished image at ${layout.root}")
        when (val record = RecordStore.load(layout) ?: throw LreException.Corrupt("run/image.properties")) {
            ImageRecord.Android -> {
                Seeder.androidDirs(layout)
                Seeder.androidFiles(layout)
            }
            is ImageRecord.Linux -> {
                val detection = Detector().detect(layout.rootfs, record.detection.config)
                if (detection != record.detection) {
                    Fixups().apply(layout.rootfs, detection, host)
                    RecordStore.save(layout, ImageRecord.Linux(detection))
                }
                Fixups().writeResolvConf(layout.rootfs, host)
                Seeder.linuxDirs(layout)
                Shims().refresh(layout, host, detection.guestPath)
                Seeder.linuxFiles(layout, host, detection, guestUnset)
            }
        }
    }

    /** Detects the current rootfs again (with the recorded image config) and redoes its fixups. */
    fun redetect(layout: ImageLayout, host: HostEnv): Detection {
        val previous = RecordStore.load(layout) as? ImageRecord.Linux
        val detection = Detector().detect(layout.rootfs, previous?.detection?.config)
        Fixups().apply(layout.rootfs, detection, host)
        RecordStore.save(layout, ImageRecord.Linux(detection))
        return detection
    }

    /** The recorded detection of a Linux image, for a step that resumes after DETECT. */
    fun recorded(layout: ImageLayout): Detection =
        (RecordStore.load(layout) as? ImageRecord.Linux)?.detection ?: throw LreException.Corrupt("run/image.properties")
}
