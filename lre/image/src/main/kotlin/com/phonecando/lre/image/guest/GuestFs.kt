package com.phonecando.lre.image.guest

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

/**
 * An unpacked rootfs seen from the host the way the guest sees it under
 * proot: an absolute symlink restarts at the rootfs and `..` stops there, so
 * links like `bin -> usr/bin` or `/etc/resolv.conf -> /run/systemd/...`
 * resolve inside the rootfs and never lead to a host file.
 */
internal class GuestFs(rootfs: File) {
    private val root: Path = rootfs.toPath()

    /** Host path of [guestPath] with every symlink followed; null on a loop. */
    fun resolve(guestPath: String): Path? = walk(guestPath, followLast = true)?.let(::host)

    /** Host path of [guestPath] with its last component left as named (to replace a link, not its target). */
    fun resolveName(guestPath: String): Path? = walk(guestPath, followLast = false)?.let(::host)

    /** The guest path [guestPath] lands on, e.g. `/usr/bin` for `/bin` in a merged-/usr image. */
    fun canonical(guestPath: String): String? =
        walk(guestPath, followLast = true)?.joinToString("/", prefix = "/")

    fun isExecutable(guestPath: String): Boolean = resolve(guestPath)?.let(FileKinds::isExecutableFile) ?: false

    fun isPlainFile(guestPath: String): Boolean = resolve(guestPath)?.let(FileKinds::isPlainFile) ?: false

    fun isDirectory(guestPath: String): Boolean = resolve(guestPath)?.let(FileKinds::isDirectory) ?: false

    /** Guest path `<dir>/<name>` of the first executable [name] in [dirs], or null. */
    fun findCommand(name: String, dirs: List<String>): String? =
        dirs.asSequence().map { child(it, name) }.firstOrNull(::isExecutable)

    private fun host(parts: List<String>): Path = parts.fold(root) { path, part -> path.resolve(part) }

    /** Guest components [guestPath] resolves to, or null after more than [MAX_LINKS] links. */
    private fun walk(guestPath: String, followLast: Boolean): List<String>? {
        val done = ArrayList<String>()
        val todo = ArrayDeque<String>()
        pushFront(todo, guestPath)
        var links = 0
        while (todo.isNotEmpty()) {
            val part = todo.removeFirst()
            if (part == "..") {
                if (done.isNotEmpty()) done.removeAt(done.size - 1)
                continue
            }
            val candidate = host(done).resolve(part)
            val last = todo.isEmpty()
            val target = if (followLast || !last) linkTarget(candidate) else null
            if (target == null) {
                done.add(part)
                continue
            }
            if (++links > MAX_LINKS) return null
            if (target.startsWith("/")) done.clear()
            pushFront(todo, target)
        }
        return done
    }

    private fun linkTarget(path: Path): String? {
        if (!Files.isSymbolicLink(path)) return null
        return try {
            Files.readSymbolicLink(path).toString()
        } catch (_: IOException) {
            null
        }
    }

    private fun pushFront(todo: ArrayDeque<String>, path: String) {
        path.split('/').filter { it.isNotEmpty() && it != "." }.asReversed().forEach(todo::addFirst)
    }

    companion object {
        /** Linux's MAXSYMLINKS: more links than this in one lookup is ELOOP. */
        const val MAX_LINKS = 40

        fun child(dir: String, name: String): String = "${dir.trimEnd('/')}/$name"
    }
}
