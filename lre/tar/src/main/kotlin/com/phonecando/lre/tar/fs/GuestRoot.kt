package com.phonecando.lre.tar.fs

import com.phonecando.lre.api.LreException
import java.nio.file.Files
import java.nio.file.Path

/** A real directory under the guest root: its components (no symlinks among them) and host path. */
internal class GuestDir(val rel: List<String>, val path: Path) {
    fun child(name: String): GuestPath = GuestPath(rel + name, path.resolve(name))
}

/** A real path under the guest root whose last component may not exist yet. */
internal class GuestPath(val rel: List<String>, val path: Path) {
    val key: String get() = rel.joinToString("/")
}

/**
 * The guest's `/` on the host. Directory components resolve the way the
 * guest would see them: a symlink is followed guest-relative (an absolute
 * target restarts at [base], a relative one continues from the link's dir)
 * and every step must stay under [base], so nothing reaches the host's own
 * files through a link the archive planted. Callers own concurrency: [base]
 * belongs to one extraction at a time.
 */
internal class GuestRoot(val base: Path) {
    /**
     * Resolves the directory components [parts] of member [entry]. With
     * [create], missing dirs are made and a non-directory in the way is
     * replaced; without it, a missing or non-directory component gives null.
     */
    fun resolveDir(parts: List<String>, entry: String, create: Boolean): GuestDir? {
        val pending = ArrayDeque(parts)
        val rel = ArrayList<String>()
        var path = base
        var hops = 0
        while (pending.isNotEmpty()) {
            val part = pending.removeFirst()
            when (part) {
                "", "." -> continue
                ".." -> {
                    if (rel.isEmpty()) throw LreException.UnsafeEntry(entry, "leaves the root through a symlink")
                    rel.removeAt(rel.lastIndex)
                    path = path.parent
                    continue
                }
            }
            val next = path.resolve(part)
            val attrs = GuestFiles.lstat(next)
            when {
                attrs == null -> {
                    if (!create) return null
                    makeDir(next)
                }
                attrs.isSymbolicLink -> {
                    if (++hops > MAX_SYMLINK_HOPS) throw LreException.UnsafeEntry(entry, "too many symlinks")
                    val target = Files.readSymbolicLink(next).toString()
                    if (target.startsWith('/')) {
                        rel.clear()
                        path = base
                    }
                    target.split('/').asReversed().forEach(pending::addFirst)
                    continue
                }
                !attrs.isDirectory -> {
                    if (!create) return null
                    Files.delete(next)
                    makeDir(next)
                }
            }
            rel += part
            path = next
        }
        return GuestDir(rel, path)
    }

    private fun makeDir(path: Path) {
        Files.createDirectory(path)
        GuestFiles.setPermissions(path, Modes.toPermissions(Modes.IMPLICIT_DIR))
    }

    private companion object {
        /** Linux's MAXSYMLINKS. */
        const val MAX_SYMLINK_HOPS = 40
    }
}
