package com.phonecando.lme.store.io

import com.phonecando.network.download.SyncedFiles
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files

/**
 * Whole-file writes that survive a crash or power cut at any point: the
 * bytes go to a temp file in the same dir, are synced, and the temp file is
 * renamed over the name; then the dir is synced so the rename itself sticks.
 * A reader sees the old file or the new one, never half of one.
 */
internal object AtomicFile {
    fun write(file: File, bytes: ByteArray) {
        val dir = file.absoluteFile.parentFile ?: throw IOException("$file has no parent dir")
        Files.createDirectories(dir.toPath())
        val tmp = File(dir, ".${file.name}.tmp")
        Files.deleteIfExists(tmp.toPath())
        FileOutputStream(tmp).use { out ->
            out.write(bytes)
            out.fd.sync()
        }
        SyncedFiles.move(tmp, file)
    }
}
