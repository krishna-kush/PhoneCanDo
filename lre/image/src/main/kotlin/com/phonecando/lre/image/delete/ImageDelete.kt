package com.phonecando.lre.image.delete

import com.phonecando.lre.api.ImageLayout
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.concurrent.Executor

/**
 * Deletes an image in two steps: one atomic rename into a trash dir (the
 * image is gone for every reader at once, and a new image may reuse the
 * id), then the slow tree delete in the background. The trash sits next to
 * the images so the rename never crosses a filesystem.
 */
class ImageDelete(private val deleter: TreeDeleter = TreeDeleter()) {
    /** Moves the image dir into [trash]; returns the trash entry, or null when there was no image. */
    fun moveToTrash(layout: ImageLayout, trash: File = trashFor(layout)): File? {
        if (!Files.exists(layout.root.toPath())) return null
        Files.createDirectories(trash.toPath())
        val entry = File(trash, "${layout.root.name}-${System.nanoTime()}")
        Files.move(layout.root.toPath(), entry.toPath(), StandardCopyOption.ATOMIC_MOVE)
        return entry
    }

    /** [moveToTrash], then deletes that entry on [background]. Returns the entry, or null when there was no image. */
    fun delete(layout: ImageLayout, background: Executor, trash: File = trashFor(layout)): File? {
        val entry = moveToTrash(layout, trash) ?: return null
        background.execute { deleter.delete(entry) }
        return entry
    }

    /** Deletes everything in [trash], e.g. at app start after a kill cut a background delete short. */
    fun emptyTrash(trash: File): Boolean {
        val entries = trash.listFiles() ?: return true
        return entries.map { deleter.delete(it) }.all { it }
    }

    companion object {
        /** `<filesDir>/images/.trash` for an image at `<filesDir>/images/<id>`. */
        fun trashFor(layout: ImageLayout): File = File(layout.root.absoluteFile.parentFile, ".trash")
    }
}
