package com.phonecando.lre.tar

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.tar.format.TarReader
import com.phonecando.lre.tar.fs.GuestRoot
import com.phonecando.lre.tar.layer.LayerWriter
import com.phonecando.lre.tar.stream.LayerStream
import com.phonecando.lre.tar.stream.SourceStream
import java.io.File
import java.io.InputStream
import java.nio.file.Files

/**
 * Unpacks tar layers (plain, gzip, xz; ustar, GNU and PAX) into a guest
 * root as our own uid, so nothing in an archive may reach outside the root:
 * absolute names and `..` escapes are rejected, symlinks are followed
 * guest-relative, hard links become copies, device nodes are skipped and
 * setuid/setgid bits dropped. OCI whiteouts apply across layers.
 *
 * Failures: [LreException.UnsafeEntry], [LreException.TooLarge] (see
 * [TarLimits]), [LreException.Corrupt] (bad or truncated stream),
 * [LreException.UnsupportedLayer] (zstd, sparse files),
 * [LreException.Cancelled]; a read failure of the input itself and disk
 * errors surface as their IOException. A failed layer leaves [extract]'s
 * dest half-written; callers discard it.
 */
class TarExtractor(private val limits: TarLimits = TarLimits()) {
    /**
     * Applies one layer onto [dest] (which may already hold lower layers).
     * [input] stays open; progress reports bytes read from it, step `unpack`.
     */
    fun extract(
        input: InputStream,
        compression: Compression,
        dest: File,
        sink: ProgressSink = ProgressSink.NONE,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): ExtractStats {
        val base = dest.absoluteFile.toPath()
        Files.createDirectories(base)
        val source = SourceStream(input)
        val progress = UnpackProgress(sink)
        val checkpoint = {
            if (cancel.isCancelled()) throw LreException.Cancelled()
            progress.update(source.count)
        }
        LayerStream.open(source, compression).use { tar ->
            val reader = TarReader(tar, limits.maxPathBytes)
            val writer = LayerWriter(GuestRoot(base), limits, checkpoint)
            while (true) {
                checkpoint()
                val entry = reader.next() ?: break
                writer.apply(entry, reader.content)
            }
            reader.drain()
            val stats = writer.finish()
            progress.finish(source.count)
            return stats
        }
    }
}
