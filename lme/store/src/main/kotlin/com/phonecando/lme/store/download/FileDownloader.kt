package com.phonecando.lme.store.download

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.Progress
import com.phonecando.lme.api.ProgressSink
import com.phonecando.lme.api.http.HttpPort
import com.phonecando.lme.api.http.HttpResponse
import com.phonecando.lme.api.http.errorFor
import com.phonecando.lme.api.http.fetch
import com.phonecando.lme.api.http.redactUrl
import com.phonecando.lme.store.io.AtomicFile
import com.phonecando.lme.store.io.Sha256
import java.io.EOFException
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

/**
 * Downloads one file into `<target>.part`, resuming what an earlier run left
 * there with an HTTP `Range` request, checks its size and sha256, and only
 * then renames it to [target]. Network trouble keeps the partial for the
 * next attempt; a wrong size or digest deletes it. Local disk failures stay
 * [IOException]s.
 *
 * Progress is reported for the whole model: [base] bytes of earlier files
 * are done, [total] is every file together.
 */
internal class FileDownloader(private val http: HttpPort, private val headers: Map<String, String>) {
    fun download(file: RemoteFile, part: File, target: File, base: Long, total: Long, sink: ProgressSink, cancel: CancelSignal) {
        val where = redactUrl(file.url)
        val size = file.sizeBytes
        var offset = if (part.isFile) part.length() else 0L
        if (offset > size) {
            part.delete()
            offset = 0
        }
        val hasher = Sha256.newDigest()
        if (offset > 0) {
            val shifted = ProgressSink { sink.report(Progress(VERIFY, base + it.done, total)) }
            Sha256.update(hasher, part, VERIFY, shifted, cancel)
        }
        if (offset == size) {
            // Every byte is here from an earlier run; keep them only if they verify.
            if (Sha256.hex(hasher) == file.sha256) return finish(part, target, base + size, total, sink)
            part.delete()
            hasher.reset()
            offset = 0
        }

        var response = open(file, offset)
        if (response.status == 416) {
            // The server will not serve our offset: our partial is not its file.
            response.close()
            part.delete()
            hasher.reset()
            offset = 0
            response = open(file, 0)
        }
        response.use {
            when (it.status) {
                206 -> if (rangeStart(it) != offset) {
                    part.delete()
                    throw LmeException.Network(where, null, IOException("range answered from another offset"))
                }
                200 -> if (offset > 0) {
                    // The server ignored Range: start over.
                    hasher.reset()
                    offset = 0
                }
                else -> throw errorFor(it.status, file.url, file.name)
            }
            offset = copy(it, part, offset, file, hasher, where, base, total, sink, cancel)
        }
        if (offset < size) throw LmeException.Network(where, null, EOFException("ended after $offset of $size bytes"))
        val actual = Sha256.hex(hasher)
        if (actual != file.sha256) {
            part.delete()
            throw LmeException.DigestMismatch(file.name, file.sha256, actual)
        }
        finish(part, target, base + size, total, sink)
    }

    /** GETs [file] from [offset]; only 2xx and 416 come back, other statuses are thrown typed. */
    private fun open(file: RemoteFile, offset: Long): HttpResponse {
        val sent = if (offset > 0) headers + ("Range" to "bytes=$offset-") else headers
        val response = http.fetch(file.url, sent)
        if (response.status in 200..299 || response.status == 416) return response
        response.close()
        throw errorFor(response.status, file.url, file.name)
    }

    private fun copy(
        response: HttpResponse,
        part: File,
        start: Long,
        file: RemoteFile,
        hasher: MessageDigest,
        where: String,
        base: Long,
        total: Long,
        sink: ProgressSink,
        cancel: CancelSignal,
    ): Long {
        var offset = start
        var reported = offset
        sink.report(Progress(STEP, base + offset, total))
        FileOutputStream(part, offset > 0).use { out ->
            val buffer = ByteArray(Sha256.CHUNK)
            while (true) {
                if (cancel.isCancelled()) {
                    out.fd.sync()
                    throw LmeException.Cancelled()
                }
                val n = try {
                    response.body.read(buffer)
                } catch (e: IOException) {
                    // A body that breaks mid-way is a dropped connection: keep what we have.
                    out.fd.sync()
                    throw LmeException.Network(where, null, e)
                }
                if (n < 0) break
                if (offset + n > file.sizeBytes) {
                    out.close()
                    part.delete()
                    throw LmeException.SizeMismatch(file.name, file.sizeBytes, offset + n)
                }
                out.write(buffer, 0, n)
                hasher.update(buffer, 0, n)
                offset += n
                if (offset - reported >= REPORT_EVERY) {
                    sink.report(Progress(STEP, base + offset, total))
                    reported = offset
                }
            }
            out.fd.sync()
        }
        return offset
    }

    private fun finish(part: File, target: File, done: Long, total: Long, sink: ProgressSink) {
        AtomicFile.moveSynced(part, target)
        sink.report(Progress(STEP, done, total))
    }

    /** Start offset of a `Content-Range: bytes <start>-<end>/<total>` answer, or null. */
    private fun rangeStart(response: HttpResponse): Long? =
        response.header("content-range")?.let { RANGE.find(it)?.groupValues?.get(1)?.toLongOrNull() }

    companion object {
        const val STEP = "download"
        const val VERIFY = "verify"
        private const val REPORT_EVERY = 1L shl 20
        private val RANGE = Regex("^\\s*bytes\\s+(\\d+)-")
    }
}
