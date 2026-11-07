package com.phonecando.lre.image.shim

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.PayloadNames
import com.phonecando.lre.image.delete.TreeDeleter
import com.phonecando.lre.image.guest.FileKinds
import com.phonecando.lre.image.guest.GuestFs
import com.phonecando.lre.image.guest.GuestPath
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/** What one shims refresh changed. */
internal data class ShimStats(val added: Int, val removed: Int, val kept: Int)

/**
 * Keeps `shims/` in step with the guest: one symlink per command on the
 * guest PATH, each pointing at our launcher, which runs that command inside
 * the image. Diff-based, so a refresh with nothing new touches nothing, and
 * a moved launcher (the APK's lib dir changes on every update) re-points
 * every link.
 */
internal class Shims {
    fun refresh(layout: ImageLayout, host: HostEnv, guestPath: String): ShimStats {
        val target = Paths.get(host.libDir.trimEnd('/'), PayloadNames.LAUNCHER)
        val wanted = scan(layout, guestPath) + ShimNames.ALWAYS
        val dir = layout.shims.toPath()
        Files.createDirectories(dir)

        val present = Files.newDirectoryStream(dir).use { stream -> stream.map { it.fileName.toString() } }
        var kept = 0
        var removed = 0
        val correct = HashSet<String>()
        for (name in present) {
            val entry = dir.resolve(name)
            if (name in wanted && pointsAt(entry, target)) {
                correct += name
                kept++
            } else {
                if (FileKinds.isDirectory(entry)) TreeDeleter().delete(entry.toFile()) else Files.deleteIfExists(entry)
                removed++
            }
        }
        var added = 0
        for (name in wanted) {
            if (name in correct) continue
            Files.createSymbolicLink(dir.resolve(name), target)
            added++
        }
        return ShimStats(added, removed, kept)
    }

    /** Names of every executable regular file (links resolved guest-side) in the guest PATH dirs. */
    fun scan(layout: ImageLayout, guestPath: String): Set<String> {
        val fs = GuestFs(layout.rootfs)
        val names = HashSet<String>()
        val seen = HashSet<Path>()
        for (dir in GuestPath.dirs(guestPath)) {
            val real = fs.canonical(dir) ?: continue
            val hostDir = fs.resolve(dir) ?: continue
            if (!FileKinds.isDirectory(hostDir) || !seen.add(hostDir)) continue
            Files.newDirectoryStream(hostDir).use { stream ->
                for (entry in stream) {
                    val name = entry.fileName.toString()
                    if (name in names || !ShimNames.isSafe(name)) continue
                    val attrs = FileKinds.attributes(entry) ?: continue
                    val runs = if (attrs.isSymbolicLink) fs.isExecutable(GuestFs.child(real, name)) else FileKinds.isExecutable(attrs)
                    if (runs) names += name
                }
            }
        }
        return names
    }

    private fun pointsAt(entry: Path, target: Path): Boolean = try {
        Files.isSymbolicLink(entry) && Files.readSymbolicLink(entry) == target
    } catch (_: IOException) {
        false
    }
}
