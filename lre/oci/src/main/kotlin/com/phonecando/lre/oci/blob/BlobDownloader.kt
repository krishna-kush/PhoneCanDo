package com.phonecando.lre.oci.blob

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.Progress
import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.oci.http.HttpResponse
import java.io.EOFException
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

/**
 * Opens a blob from byte [offset]: 0 asks for all of it, anything else is a
 * `Range: bytes=<offset>-` request. Returns only 200, 206 or 416 responses;
 * other outcomes are thrown as [LreException]s.
 */
internal fun interface BlobOpener {
    fun open(offset: Long): HttpResponse
}

/**
 * Downloads one blob into `<dir>/sha256-<hex>.part`, resuming a partial
 * file, verifies its digest and renames it to `<dir>/sha256-<hex>`.
 * Network trouble keeps the partial for the next attempt; a digest mismatch
 * deletes it. Local disk failures surface as [IOException]. One download per
 * blob file at a time.
 */
internal class BlobDownloader {
    /** The complete blob already in [dir], re-verified; a bad one is deleted and null returned. */
    fun existing(digest: Digest, size: Long, dir: File, cancel: CancelSignal): File? {
        val target = File(dir, digest.fileName)
        if (!target.isFile) return null
        if (target.length() == size && Sha256.hex(target, cancel) == digest.hex) return target
        target.delete()
        return null
    }

    /** Bytes of [digest] already in [dir]'s partial file (0 when none or unusable). */
    fun partialBytes(digest: Digest, size: Long, dir: File): Long {
        val part = File(dir, digest.fileName + PART)
        return if (part.isFile && part.length() <= size) part.length() else 0L
    }

    /** [where] is the redacted URL we name in errors. */
    fun download(
        opener: BlobOpener,
        where: String,
        digest: Digest,
        size: Long,
        dir: File,
        sink: ProgressSink,
        cancel: CancelSignal,
    ): File {
        val part = File(dir, digest.fileName + PART)
        val target = File(dir, digest.fileName)
        var offset = if (part.isFile) part.length() else 0L
        if (offset > size) {
            part.delete()
            offset = 0
        }
        val hasher = Sha256.newDigest()
        if (offset > 0) Sha256.update(hasher, part, cancel)
        if (offset == size && part.isFile) {
            // All bytes are here from an earlier run; keep them only if they verify.
            if (Sha256.toHex(hasher.digest()) == digest.hex) return moveIntoPlace(part, target, size, sink)
            part.delete()
            offset = 0
        }

        var response = opener.open(offset)
        if (response.status == 416) {
            // The server will not serve our offset: our partial is not its blob.
            response.close()
            part.delete()
            hasher.reset()
            offset = 0
            response = opener.open(0)
        }
        response.use {
            when (it.status) {
                206 -> if (rangeStart(it) != offset) {
                    part.delete()
                    throw LreException.Network(where, null, IOException("range answered from another offset"))
                }
                200 -> if (offset > 0) {
                    // The server ignored Range: start over.
                    hasher.reset()
                    offset = 0
                }
                else -> throw LreException.Network(where, it.status)
            }
            offset = copy(it, part, append = offset > 0, offset, size, hasher, digest, where, sink, cancel)
        }
        if (offset < size) throw LreException.Network(where, null, EOFException("blob ended after $offset of $size bytes"))
        val actual = Sha256.toHex(hasher.digest())
        if (actual != digest.hex) {
            part.delete()
            throw LreException.DigestMismatch(digest.toString(), "${Digest.ALGORITHM}:$actual")
        }
        return moveIntoPlace(part, target, size, sink)
    }

    private fun copy(
        response: HttpResponse,
        part: File,
        append: Boolean,
        start: Long,
        size: Long,
        hasher: MessageDigest,
        digest: Digest,
        where: String,
        sink: ProgressSink,
        cancel: CancelSignal,
    ): Long {
        var offset = start
        var reported = offset
        sink.report(Progress(STEP, offset, size))
        FileOutputStream(part, append).use { out ->
            val buffer = ByteArray(CHUNK)
            while (true) {
                if (cancel.isCancelled()) throw LreException.Cancelled()
                val n = try {
                    response.body.read(buffer)
                } catch (e: IOException) {
                    // A body that breaks mid-way is a dropped connection, worth a retry.
                    throw LreException.Network(where, null, e)
                }
                if (n < 0) break
                if (offset + n > size) {
                    out.close()
                    part.delete()
                    throw LreException.TooLarge("blob $digest", size)
                }
                out.write(buffer, 0, n)
                hasher.update(buffer, 0, n)
                offset += n
                if (offset - reported >= REPORT_EVERY) {
                    sink.report(Progress(STEP, offset, size))
                    reported = offset
                }
            }
        }
        return offset
    }

    private fun moveIntoPlace(part: File, target: File, size: Long, sink: ProgressSink): File {
        if (!part.renameTo(target)) {
            target.delete()
            if (!part.renameTo(target)) throw IOException("cannot rename ${part.name}")
        }
        sink.report(Progress(STEP, size, size))
        return target
    }

    /** Start offset of a `Content-Range: bytes <start>-<end>/<total>` answer, or null. */
    private fun rangeStart(response: HttpResponse): Long? =
        response.header("content-range")?.let { RANGE.find(it)?.groupValues?.get(1)?.toLongOrNull() }

    companion object {
        /** Progress step name for blob downloads. */
        const val STEP = "download"
        private const val PART = ".part"
        private const val CHUNK = 64 * 1024
        private const val REPORT_EVERY = 256L * 1024
        private val RANGE = Regex("^\\s*bytes\\s+(\\d+)-")
    }
}
