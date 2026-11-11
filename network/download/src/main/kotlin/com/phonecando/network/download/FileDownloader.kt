package com.phonecando.network.download

import com.phonecando.network.CancelSignal
import com.phonecando.network.NetException
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import com.phonecando.network.http.HttpResponse
import com.phonecando.network.http.errorFor
import java.io.EOFException
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

/**
 * Downloads one file into its `.part` [part], resuming what an earlier try
 * left there with an HTTP `Range` request, checks its size and sha256, and
 * only then renames it to [target] (synced). Network trouble keeps the
 * partial for the next try; a wrong size or digest deletes it. Local disk
 * failures stay [IOException]s; the rest are [NetException]s.
 *
 * Progress is reported for the whole job: [base] bytes of earlier files are
 * done, [total] is every file together. A try that stops with the partial
 * kept leaves how far it is hashed in [checkpoints], so the next try in this
 * process does not read it all back first. A cancel cuts even a read that
 * hangs ([CancelWatch]). One instance per file download.
 */
class FileDownloader(private val checkpoints: HashCheckpoints = HashCheckpoints()) {
    // The bytes of the partial written and hashed so far: what a checkpoint records.
    private var written = 0L

    fun download(
        file: ExpectedFile,
        opener: RangeOpener,
        part: File,
        target: File,
        base: Long,
        total: Long,
        sink: ProgressSink,
        cancel: CancelSignal,
    ) {
        var offset = if (part.isFile) part.length() else 0L
        if (offset > file.sizeBytes) {
            part.delete()
            offset = 0
        }
        val hasher = checkpoints.take(part, offset) ?: Sha256.newDigest().also { fresh ->
            if (offset > 0) {
                val shifted = ProgressSink { sink.report(Progress(Sha256.VERIFY, base + it.done, total)) }
                Sha256.update(fresh, part, Sha256.VERIFY, shifted, cancel)
            }
        }
        written = offset
        try {
            fetch(file, opener, part, target, offset, hasher, base, total, sink, cancel)
        } catch (e: NetException) {
            if (e is NetException.Network || e is NetException.Cancelled) checkpoints.keep(part, written, hasher)
            throw e
        }
    }

    private fun fetch(
        file: ExpectedFile,
        opener: RangeOpener,
        part: File,
        target: File,
        start: Long,
        hasher: MessageDigest,
        base: Long,
        total: Long,
        sink: ProgressSink,
        cancel: CancelSignal,
    ) {
        val where = opener.where
        val size = file.sizeBytes
        var offset = start
        if (offset == size) {
            // Every byte is here from an earlier run; keep them only if they verify.
            if (Sha256.hex(hasher) == file.sha256) return finish(part, target, base + size, total, sink)
            part.delete()
            hasher.reset()
            offset = 0
        }

        var response = opener.open(offset)
        if (response.status == 416) {
            // The server will not serve our offset: our partial is not its file.
            response.close()
            part.delete()
            hasher.reset()
            offset = 0
            response = opener.open(0)
        }
        response.use {
            when (it.status) {
                206 -> {
                    // Without Content-Range it starts at our offset only if it is exactly the bytes we lack.
                    val from = rangeStart(it) ?: offset.takeIf { _ -> it.header("content-length")?.toLongOrNull() == size - offset }
                    if (from == null) {
                        // An answer we cannot place says nothing against our partial: keep it, try again.
                        throw NetException.Network(where, null, IOException("range answered without Content-Range"))
                    }
                    if (from != offset) {
                        part.delete()
                        throw NetException.Network(where, null, IOException("range answered from another offset"))
                    }
                }
                200 -> if (offset > 0) {
                    // The server ignored Range: start over.
                    hasher.reset()
                    offset = 0
                }
                else -> throw errorFor(it, where, file.name)
            }
            offset = copy(it, part, offset, file, hasher, where, base, total, sink, cancel)
        }
        if (offset < size) throw NetException.Network(where, null, EOFException("ended after $offset of $size bytes"))
        val actual = Sha256.hex(hasher)
        if (actual != file.sha256) {
            part.delete()
            throw NetException.DigestMismatch(file.name, file.sha256, actual)
        }
        finish(part, target, base + size, total, sink)
    }

    private fun copy(
        response: HttpResponse,
        part: File,
        start: Long,
        file: ExpectedFile,
        hasher: MessageDigest,
        where: String,
        base: Long,
        total: Long,
        sink: ProgressSink,
        cancel: CancelSignal,
    ): Long {
        var offset = start
        var reported = offset
        written = offset
        sink.report(Progress(STEP, base + offset, total))
        FileOutputStream(part, offset > 0).use { out ->
            val buffer = ByteArray(Sha256.CHUNK)
            val watch = CancelWatch.abortOnCancel(cancel, response)
            try {
                while (true) {
                    if (cancel.isCancelled()) {
                        out.fd.sync()
                        throw NetException.Cancelled()
                    }
                    val n = try {
                        response.body.read(buffer)
                    } catch (e: Exception) {
                        // A body that breaks mid-way is a dropped connection, or our abort on a cancel: keep what we have.
                        out.fd.sync()
                        if (cancel.isCancelled()) throw NetException.Cancelled()
                        if (e is IOException) throw NetException.Network(where, null, e)
                        throw e
                    }
                    if (n < 0) break
                    if (offset + n > file.sizeBytes) {
                        out.close()
                        part.delete()
                        throw NetException.SizeMismatch(file.name, file.sizeBytes, offset + n)
                    }
                    out.write(buffer, 0, n)
                    hasher.update(buffer, 0, n)
                    offset += n
                    written = offset
                    if (offset - reported >= REPORT_EVERY) {
                        sink.report(Progress(STEP, base + offset, total))
                        reported = offset
                    }
                }
            } finally {
                watch.close()
            }
            out.fd.sync()
        }
        return offset
    }

    private fun finish(part: File, target: File, done: Long, total: Long, sink: ProgressSink) {
        checkpoints.forget(part)
        SyncedFiles.move(part, target)
        sink.report(Progress(STEP, done, total))
    }

    /** Start offset of a `Content-Range: bytes <start>-<end>/<total>` answer, or null. */
    private fun rangeStart(response: HttpResponse): Long? =
        response.header("content-range")?.let { RANGE.find(it)?.groupValues?.get(1)?.toLongOrNull() }

    companion object {
        /** The progress step of bytes arriving. */
        const val STEP = "download"
        private const val REPORT_EVERY = 1L shl 20
        private val RANGE = Regex("^\\s*bytes\\s+(\\d+)-")
    }
}
