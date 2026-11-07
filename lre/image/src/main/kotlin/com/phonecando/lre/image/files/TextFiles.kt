package com.phonecando.lre.image.files

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.nio.file.attribute.BasicFileAttributes

/**
 * Small text files, read and written whole. A write goes to a temp file in
 * the same dir and is renamed over the name: the rename replaces whatever
 * stands there (a symlink included) without following it, and a reader never
 * sees half a file. A read never goes through a symlink.
 */
internal object TextFiles {
    /** Writes [text] to [file] unless a plain file already holds exactly it; true when it wrote. */
    fun write(file: File, text: String): Boolean {
        val path = file.toPath()
        val bytes = text.toByteArray(Charsets.UTF_8)
        if (holds(path, bytes)) return false
        val dir = path.parent ?: throw IOException("$file has no parent dir")
        Files.createDirectories(dir)
        val tmp = dir.resolve(".${path.fileName}.tmp")
        Files.deleteIfExists(tmp)
        Files.newOutputStream(tmp, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE).use { it.write(bytes) }
        Files.move(tmp, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        return true
    }

    /** Text of [path] when it is a plain file of at most [limit] bytes; null otherwise. */
    fun read(path: Path, limit: Long = 1L shl 20): String? {
        val attrs = attributes(path) ?: return null
        if (!attrs.isRegularFile || attrs.size() > limit) return null
        return String(Files.readAllBytes(path), Charsets.UTF_8)
    }

    fun read(file: File, limit: Long = 1L shl 20): String? = read(file.toPath(), limit)

    /** Removes [file] when it is a plain file or a symlink; never follows one. */
    fun delete(file: File) {
        Files.deleteIfExists(file.toPath())
    }

    private fun holds(path: Path, bytes: ByteArray): Boolean {
        val attrs = attributes(path) ?: return false
        if (!attrs.isRegularFile || attrs.size() != bytes.size.toLong()) return false
        return Files.readAllBytes(path).contentEquals(bytes)
    }

    private fun attributes(path: Path): BasicFileAttributes? = try {
        Files.readAttributes(path, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
    } catch (_: NoSuchFileException) {
        null
    }
}
