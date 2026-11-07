package com.phonecando.lre.tar.layer

import com.phonecando.lre.api.LreException
import com.phonecando.lre.tar.ExtractStats
import com.phonecando.lre.tar.TarLimits
import com.phonecando.lre.tar.format.EntryKind
import com.phonecando.lre.tar.format.TarEntry
import com.phonecando.lre.tar.fs.GuestFiles
import com.phonecando.lre.tar.fs.GuestPath
import com.phonecando.lre.tar.fs.GuestRoot
import com.phonecando.lre.tar.fs.Modes
import com.phonecando.lre.tar.path.EntryPath
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.FileTime

/**
 * Applies the members of one layer onto a guest root that may already hold
 * lower layers. An entry replaces whatever is at its path unless both are
 * dirs, and never writes through a symlink there. [tick] runs between
 * chunks of large files (cancel checks, progress).
 */
internal class LayerWriter(
    private val root: GuestRoot,
    private val limits: TarLimits,
    private val tick: () -> Unit,
) {
    private val paths = LayerPaths()
    private val prune = LowerPrune(paths)
    private val stats = StatsCounter()
    private val dirTimes = ArrayList<Pair<Path, FileTime>>()
    private val buffer = ByteArray(COPY_BUFFER)

    fun apply(entry: TarEntry, content: InputStream) {
        if (++stats.entries > limits.maxEntries) throw LreException.TooLarge("tar entries", limits.maxEntries.toLong(), "entries")
        checkLength(entry.name, "entry path")
        val parts = EntryPath.parse(entry.name)
        if (parts.isEmpty()) {
            // `./` itself: the host made the root and keeps its mode.
            if (entry.kind != EntryKind.DIR) throw LreException.UnsafeEntry(entry.name, "replaces the root")
            stats.dirs++
            return
        }
        val whiteout = Whiteout.parse(parts, entry.name)
        if (whiteout != null) return applyWhiteout(parts, whiteout, entry.name)
        when (entry.kind) {
            EntryKind.FILE -> writeFile(parts, entry, content)
            EntryKind.DIR -> writeDir(parts, entry)
            EntryKind.SYMLINK -> writeSymlink(parts, entry)
            EntryKind.HARDLINK -> copyHardLink(parts, entry)
            EntryKind.SPECIAL, EntryKind.UNKNOWN -> stats.skipped++
        }
    }

    /** Sets directory times last (writing into a dir changes its mtime) and returns the totals. */
    fun finish(): ExtractStats {
        for ((path, time) in dirTimes) if (GuestFiles.lstat(path)?.isDirectory == true) GuestFiles.setMtime(path, time)
        return stats.snapshot()
    }

    private fun writeFile(parts: List<String>, entry: TarEntry, content: InputStream) {
        if (entry.size > limits.maxFileBytes) throw LreException.TooLarge("file ${entry.name}", limits.maxFileBytes)
        reserve(entry.size)
        val target = place(parts, entry.name)
        clear(target, keepDir = false)
        Files.newOutputStream(target.path, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, LinkOption.NOFOLLOW_LINKS)
            .use { copy(content, it) }
        GuestFiles.setPermissions(target.path, Modes.file(entry.mode))
        GuestFiles.setMtime(target.path, entry.mtime)
        paths.add(target.key)
        stats.files++
        stats.bytes += entry.size
    }

    private fun writeDir(parts: List<String>, entry: TarEntry) {
        val target = place(parts, entry.name)
        if (!clear(target, keepDir = true)) Files.createDirectory(target.path)
        GuestFiles.setPermissions(target.path, Modes.dir(entry.mode))
        dirTimes += target.path to entry.mtime
        paths.add(target.key)
        stats.dirs++
    }

    private fun writeSymlink(parts: List<String>, entry: TarEntry) {
        if (entry.linkName.isEmpty()) {
            stats.skipped++
            return
        }
        checkLink(entry)
        val target = place(parts, entry.name)
        clear(target, keepDir = false)
        // Kept as written (absolute targets are guest paths); NIO only collapses repeated and trailing slashes.
        Files.createSymbolicLink(target.path, root.base.fileSystem.getPath(entry.linkName))
        GuestFiles.setLinkMtime(target.path, entry.mtime)
        paths.add(target.key)
        stats.symlinks++
    }

    /** Untrusted apps may not create hard links, so the link becomes a copy of its (already extracted) target. */
    private fun copyHardLink(parts: List<String>, entry: TarEntry) {
        checkLink(entry)
        val sourceParts = EntryPath.parse(entry.linkName)
        if (sourceParts.isEmpty()) throw LreException.UnsafeEntry(entry.name, "hard link to the root")
        // The link's own dir first: making it may replace a file the source path runs through.
        val target = place(parts, entry.name)
        val source = root.resolveDir(sourceParts.dropLast(1), entry.name, create = false)?.child(sourceParts.last())
        val attrs = source?.let { GuestFiles.lstat(it.path) }
        if (source == null || attrs == null) throw LreException.Corrupt("tar hard link target ${entry.linkName} (missing)")
        when {
            attrs.isDirectory -> throw LreException.UnsafeEntry(entry.name, "hard link to a directory")
            source.path == target.path -> Unit
            source.path.startsWith(target.path) -> throw LreException.UnsafeEntry(entry.name, "replaces its own link target")
            attrs.isSymbolicLink -> {
                clear(target, keepDir = false)
                Files.createSymbolicLink(target.path, Files.readSymbolicLink(source.path))
                GuestFiles.setLinkMtime(target.path, attrs.lastModifiedTime())
            }
            attrs.isRegularFile -> {
                if (attrs.size() > limits.maxFileBytes) throw LreException.TooLarge("file ${entry.name}", limits.maxFileBytes)
                reserve(attrs.size())
                clear(target, keepDir = false)
                Files.copy(source.path, target.path, StandardCopyOption.COPY_ATTRIBUTES, LinkOption.NOFOLLOW_LINKS)
                stats.bytes += attrs.size()
            }
            else -> {
                stats.skipped++
                return
            }
        }
        paths.add(target.key)
        stats.hardlinksCopied++
    }

    private fun applyWhiteout(parts: List<String>, whiteout: Whiteout, entry: String) {
        if (whiteout == Whiteout.Ignored) {
            stats.skipped++
            return
        }
        stats.whiteouts++
        // Nothing below a missing dir to remove; never create one for a marker.
        val dir = root.resolveDir(parts.dropLast(1), entry, create = false) ?: return
        when (whiteout) {
            is Whiteout.Remove -> {
                val target = dir.child(whiteout.name)
                if (GuestFiles.lstat(target.path) != null) prune.prune(target.key, target.path)
            }
            Whiteout.Opaque -> prune.pruneChildren(dir.rel.joinToString("/"), dir.path)
            Whiteout.Ignored -> Unit
        }
    }

    /** The real path for member [parts]: its dir resolved (and made) inside the guest. */
    private fun place(parts: List<String>, entry: String): GuestPath =
        checkNotNull(root.resolveDir(parts.dropLast(1), entry, create = true)).child(parts.last())

    /** Frees [target] for a new entry; true when an existing dir was kept instead. */
    private fun clear(target: GuestPath, keepDir: Boolean): Boolean {
        val attrs = GuestFiles.lstat(target.path) ?: return false
        if (attrs.isDirectory && keepDir) return true
        if (attrs.isDirectory) GuestFiles.deleteTree(target.path) else Files.delete(target.path)
        return false
    }

    private fun copy(content: InputStream, out: OutputStream) {
        var sinceTick = 0L
        while (true) {
            val n = content.read(buffer)
            if (n < 0) return
            out.write(buffer, 0, n)
            sinceTick += n
            if (sinceTick >= TICK_BYTES) {
                sinceTick = 0
                tick()
            }
        }
    }

    private fun reserve(bytes: Long) {
        if (stats.bytes + bytes > limits.maxTotalBytes) {
            throw LreException.TooLarge("layer contents", limits.maxTotalBytes)
        }
    }

    private fun checkLink(entry: TarEntry) {
        checkLength(entry.linkName, "link target")
        if (entry.linkName.indexOf('\u0000') >= 0) throw LreException.UnsafeEntry(entry.name, "NUL in link target")
    }

    private fun checkLength(text: String, what: String) {
        if (EntryPath.utf8Length(text) > limits.maxPathBytes) throw LreException.TooLarge(what, limits.maxPathBytes.toLong())
    }

    private companion object {
        const val COPY_BUFFER = 64 * 1024
        const val TICK_BYTES = 1L shl 20
    }
}
