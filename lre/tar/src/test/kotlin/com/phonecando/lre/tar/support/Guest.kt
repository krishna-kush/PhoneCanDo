package com.phonecando.lre.tar.support

import com.phonecando.lre.api.Compression
import com.phonecando.lre.tar.ExtractStats
import com.phonecando.lre.tar.TarExtractor
import com.phonecando.lre.tar.TarLimits
import com.phonecando.network.CancelSignal
import com.phonecando.network.ProgressSink
import java.io.ByteArrayInputStream
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermissions
import kotlin.io.path.createDirectories
import kotlin.io.path.readText
import kotlin.io.path.writeText
import kotlin.test.assertEquals

/**
 * A guest root `work/dest` next to a canary `work/canary/secret`: escape
 * tests assert the canary and the rest of `work/` stay exactly as they were.
 */
class Guest(tmp: Path) {
    val work: Path = tmp.resolve("work").createDirectories()
    val dest: Path = work.resolve("dest")
    val canary: Path = work.resolve("canary").createDirectories()
    val secret: Path = canary.resolve("secret").also { it.writeText(SECRET) }

    fun extract(
        bytes: ByteArray,
        compression: Compression = Compression.NONE,
        limits: TarLimits = TarLimits(),
        sink: ProgressSink = ProgressSink.NONE,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): ExtractStats = TarExtractor(limits).extract(ByteArrayInputStream(bytes), compression, dest.toFile(), sink, cancel)

    fun path(rel: String): Path = dest.resolve(rel)

    fun text(rel: String): String = path(rel).readText()

    fun exists(rel: String): Boolean = Files.exists(path(rel), LinkOption.NOFOLLOW_LINKS)

    fun isSymlink(rel: String): Boolean = Files.isSymbolicLink(path(rel))

    fun isDir(rel: String): Boolean = Files.isDirectory(path(rel), LinkOption.NOFOLLOW_LINKS)

    fun isFile(rel: String): Boolean = Files.isRegularFile(path(rel), LinkOption.NOFOLLOW_LINKS)

    fun linkTarget(rel: String): String = Files.readSymbolicLink(path(rel)).toString()

    fun mode(rel: String): String =
        PosixFilePermissions.toString(Files.getPosixFilePermissions(path(rel), LinkOption.NOFOLLOW_LINKS))

    /** Every path under dest, relative, symlinks not followed. */
    fun tree(): Set<String> = Files.walk(dest).use { paths ->
        paths.filter { it != dest }.map { dest.relativize(it).toString() }.toList().toSet()
    }

    /** Nothing outside dest was created, changed or removed. */
    fun assertOutsideUntouched() {
        val outside = Files.walk(work).use { paths ->
            paths.filter { it != work && !it.startsWith(dest) }.map { work.relativize(it).toString() }.toList().toSet()
        }
        assertEquals(setOf("canary", "canary/secret"), outside)
        assertEquals(SECRET, secret.readText())
    }

    companion object {
        const val SECRET = "secret"
    }
}
