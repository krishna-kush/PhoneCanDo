package com.phonecando.lre.image.setup

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.conf.EngineEnv
import com.phonecando.lre.image.conf.LaunchConf
import com.phonecando.lre.image.conf.OsNote
import com.phonecando.lre.image.detect.Detection
import com.phonecando.lre.image.files.TextFiles
import com.phonecando.lre.image.proc.CpuIds
import com.phonecando.lre.image.proc.FakeProc
import java.io.File
import java.nio.file.Files

/** Writes an image's dirs and run/ files; every write is skipped when the content is already there. */
internal object Seeder {
    fun linuxDirs(layout: ImageLayout) {
        androidDirs(layout)
        listOf(layout.shm, layout.prootTmp, layout.l2s, layout.fakeProc, layout.shims)
            .forEach { Files.createDirectories(it.toPath()) }
    }

    fun androidDirs(layout: ImageLayout) {
        listOf(layout.home, layout.tmp, layout.logs, layout.run).forEach { Files.createDirectories(it.toPath()) }
    }

    /** Fake /proc, engine.env, launch.conf and os-note.md for a Linux image. */
    fun linuxFiles(layout: ImageLayout, host: HostEnv, detection: Detection, cpuIds: List<Int> = CpuIds.host()) {
        FakeProc.files(cpuIds).forEach { (name, text) -> TextFiles.write(File(layout.fakeProc, name), text) }
        TextFiles.write(layout.engineEnv, EngineEnv.linux(layout, host))
        TextFiles.write(layout.launchConf, LaunchConf.build(layout, host, detection))
        TextFiles.write(layout.osNote, OsNote.text(detection.os))
    }

    /** engine.env with HOME and TMPDIR only; no launch.conf, no os-note.md. */
    fun androidFiles(layout: ImageLayout) {
        TextFiles.write(layout.engineEnv, EngineEnv.android(layout))
        TextFiles.delete(layout.launchConf)
        TextFiles.delete(layout.osNote)
    }
}
