package com.phonecando.lre.tar.layer

import com.phonecando.lre.tar.fs.GuestFiles
import java.nio.file.Files
import java.nio.file.Path

/** Removes what lower layers left at a path while keeping everything this layer wrote there. */
internal class LowerPrune(private val paths: LayerPaths) {
    fun prune(key: String, path: Path) {
        if (!paths.touched(key)) {
            GuestFiles.deleteTree(path)
            return
        }
        if (GuestFiles.lstat(path)?.isDirectory == true) pruneChildren(key, path)
    }

    fun pruneChildren(key: String, dir: Path) {
        val children = Files.newDirectoryStream(dir).use { it.toList() }
        for (child in children) {
            val name = child.fileName.toString()
            prune(if (key.isEmpty()) name else "$key/$name", child)
        }
    }
}
