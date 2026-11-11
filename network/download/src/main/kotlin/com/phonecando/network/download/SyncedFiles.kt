package com.phonecando.network.download

import java.io.File
import java.io.IOException
import java.nio.channels.FileChannel
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption

/** Renames that survive a crash or a power cut: atomic, then the dir synced so the rename itself sticks. */
object SyncedFiles {
    /** Renames [from] over [to] (same dir) and syncs the dir. */
    fun move(from: File, to: File) {
        Files.move(from.toPath(), to.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        syncDir(to.absoluteFile.parentFile)
    }

    /** Best effort: some file systems refuse to open a dir for sync, and then there is nothing more we can do. */
    fun syncDir(dir: File) {
        try {
            FileChannel.open(dir.toPath(), StandardOpenOption.READ).use { it.force(true) }
        } catch (_: IOException) {
        }
    }
}
