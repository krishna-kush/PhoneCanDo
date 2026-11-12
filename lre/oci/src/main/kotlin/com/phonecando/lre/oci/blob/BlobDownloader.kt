package com.phonecando.lre.oci.blob

import com.phonecando.network.CancelSignal
import com.phonecando.network.ProgressSink
import com.phonecando.network.download.ExpectedFile
import com.phonecando.network.download.FileDownloader
import com.phonecando.network.download.HashCheckpoints
import com.phonecando.network.download.RangeOpener
import com.phonecando.network.download.Sha256
import java.io.File

/**
 * Layer blobs in a download dir: `<dir>/sha256-<hex>` once complete and
 * verified, `<dir>/sha256-<hex>.part` while it arrives. The download itself
 * is network's [FileDownloader]: it resumes the partial, verifies size and
 * digest, keeps the partial on network trouble and deletes it on a mismatch.
 * Throws network's errors; the caller maps them. One download per blob file
 * at a time.
 */
internal class BlobDownloader(private val checkpoints: HashCheckpoints = HashCheckpoints()) {
    /** The complete blob already in [dir], re-verified (reported as `verify`); a bad one is deleted and null returned. */
    fun existing(digest: Digest, size: Long, dir: File, sink: ProgressSink, cancel: CancelSignal): File? {
        val target = File(dir, digest.fileName)
        if (!target.isFile) return null
        if (target.length() == size) {
            val hasher = Sha256.newDigest()
            Sha256.update(hasher, target, Sha256.VERIFY, sink, cancel)
            if (Sha256.hex(hasher) == digest.hex) return target
        }
        target.delete()
        return null
    }

    /** Bytes of [digest] already in [dir]'s partial file (0 when none or unusable). */
    fun partialBytes(digest: Digest, size: Long, dir: File): Long {
        val part = File(dir, digest.fileName + PART)
        return if (part.isFile && part.length() <= size) part.length() else 0L
    }

    /** Downloads [digest] from [opener] into [dir]; progress is step `download` (and `verify` for a resumed partial) in bytes of [size]. */
    fun download(opener: RangeOpener, digest: Digest, size: Long, dir: File, sink: ProgressSink, cancel: CancelSignal): File {
        val target = File(dir, digest.fileName)
        val expected = ExpectedFile("blob $digest", size, digest.hex)
        FileDownloader(checkpoints).download(expected, opener, File(dir, digest.fileName + PART), target, 0, size, sink, cancel)
        return target
    }

    companion object {
        /** Progress step name for blob downloads. */
        const val STEP = FileDownloader.STEP
        private const val PART = ".part"
    }
}
