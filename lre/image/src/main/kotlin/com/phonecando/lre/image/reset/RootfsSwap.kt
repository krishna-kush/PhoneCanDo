package com.phonecando.lre.image.reset

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.delete.TreeDeleter
import com.phonecando.lre.image.files.TextFiles
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.StandardCopyOption

/**
 * Swaps a fresh `rootfs.new` in for `rootfs` so that a kill at any point
 * leaves a working image. The marker `run/reset-swap` says "rootfs.new is
 * finished" and holds the reinstall list; it is written before the first
 * rename, so [recover] finishes a cut-short swap on the next start and
 * throws away a cut-short unpack.
 */
internal class RootfsSwap(private val deleter: TreeDeleter = TreeDeleter()) {
    fun newRoot(layout: ImageLayout) = File(layout.root, "rootfs.new")

    private fun oldRoot(layout: ImageLayout) = File(layout.root, "rootfs.old")

    private fun marker(layout: ImageLayout) = File(layout.run, "reset-swap")

    /** Swaps the finished [newRoot] in, then deletes the old rootfs. */
    fun swap(layout: ImageLayout, reinstall: ReinstallList?) {
        TextFiles.write(marker(layout), reinstall?.encode().orEmpty())
        recover(layout)
    }

    /**
     * Brings the image back to one `rootfs`. True when a reset's swap was
     * finished here or just before a kill: the caller re-detects, since the
     * record may still describe the old rootfs.
     */
    fun recover(layout: ImageLayout): Boolean {
        val marker = marker(layout)
        val current = layout.rootfs
        val new = newRoot(layout)
        val old = oldRoot(layout)
        val finished = exists(marker)
        if (finished && exists(new)) {
            if (exists(current)) {
                if (exists(old)) clear(old)
                move(current, old)
            }
            move(new, current)
        }
        if (finished) finishMarker(layout)
        if (!exists(current) && exists(old)) move(old, current)
        if (exists(new)) clear(new)
        if (exists(old)) clear(old)
        return finished
    }

    /** The marker becomes run/reinstall.txt, or goes away (with any older list) when it holds none. */
    private fun finishMarker(layout: ImageLayout) {
        val marker = marker(layout)
        val list = TextFiles.read(marker)?.let(ReinstallList::decode)
        if (list != null) {
            move(marker, ReinstallList.file(layout))
        } else {
            TextFiles.delete(marker)
            ReinstallList.clear(layout)
        }
    }

    private fun clear(dir: File) {
        if (!deleter.delete(dir)) throw IOException("could not delete $dir")
    }

    private fun exists(file: File) = Files.exists(file.toPath(), LinkOption.NOFOLLOW_LINKS)

    private fun move(from: File, to: File) {
        Files.move(from.toPath(), to.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    }
}
