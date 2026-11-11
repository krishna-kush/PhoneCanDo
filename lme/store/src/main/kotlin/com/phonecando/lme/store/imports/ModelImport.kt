package com.phonecando.lme.store.imports

import com.phonecando.lme.api.LmeException
import com.phonecando.network.CancelSignal
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import com.phonecando.network.download.Sha256
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream

/**
 * Copies a model file in from a stream (the system file picker's) to
 * [part]: the first bytes must be the GGUF magic, so a wrong file fails at
 * once instead of after gigabytes. Returns the size and sha256 of what was
 * copied. Read errors on [input] stay [IOException]s.
 */
internal object ModelImport {
    const val STEP = "import"
    private val MAGIC = "GGUF".toByteArray(Charsets.US_ASCII)
    private const val REPORT_EVERY = 1L shl 20

    class Copied(val sizeBytes: Long, val sha256: String)

    fun copy(input: InputStream, part: File, sizeHint: Long?, sink: ProgressSink, cancel: CancelSignal): Copied {
        val hasher = Sha256.newDigest()
        var total = 0L
        var reported = 0L
        FileOutputStream(part).use { out ->
            val buffer = ByteArray(Sha256.CHUNK)
            val head = readHead(input, buffer)
            if (head < MAGIC.size || !(0 until MAGIC.size).all { buffer[it] == MAGIC[it] }) {
                throw LmeException.InvalidGguf("no GGUF magic")
            }
            var n = head
            while (n > 0) {
                if (cancel.isCancelled()) throw LmeException.Cancelled()
                out.write(buffer, 0, n)
                hasher.update(buffer, 0, n)
                total += n
                if (total - reported >= REPORT_EVERY) {
                    sink.report(Progress(STEP, total, sizeHint))
                    reported = total
                }
                n = input.read(buffer).coerceAtLeast(0)
            }
            out.fd.sync()
        }
        sink.report(Progress(STEP, total, sizeHint))
        if (sizeHint != null && total != sizeHint) throw LmeException.SizeMismatch(part.name.removeSuffix(".part"), sizeHint, total)
        return Copied(total, Sha256.hex(hasher))
    }

    /** Fills [buffer] as far as the stream allows; a short first read must not fail the magic check. */
    private fun readHead(input: InputStream, buffer: ByteArray): Int {
        var filled = 0
        while (filled < buffer.size) {
            val n = input.read(buffer, filled, buffer.size - filled)
            if (n < 0) break
            filled += n
        }
        return filled
    }
}
