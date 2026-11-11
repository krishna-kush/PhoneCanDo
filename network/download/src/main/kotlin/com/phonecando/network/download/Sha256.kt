package com.phonecando.network.download

import com.phonecando.network.CancelSignal
import com.phonecando.network.NetException
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/** SHA-256 helpers: lower-case hex, cancellable over files. */
object Sha256 {
    const val CHUNK = 256 * 1024

    fun newDigest(): MessageDigest = MessageDigest.getInstance("SHA-256")

    /** The hex of [digest]'s hash so far; it starts over after. */
    fun hex(digest: MessageDigest): String = toHex(digest.digest())

    fun hex(bytes: ByteArray): String = toHex(newDigest().digest(bytes))

    fun hex(file: File, cancel: CancelSignal): String = newDigest().also { update(it, file, cancel = cancel) }.let(::hex)

    /** Feeds all of [file] into [digest], checking [cancel] between chunks and reporting [step]. */
    fun update(digest: MessageDigest, file: File, step: String = VERIFY, sink: ProgressSink = ProgressSink.NONE, cancel: CancelSignal) {
        val total = file.length()
        var done = 0L
        FileInputStream(file).use { input ->
            val buffer = ByteArray(CHUNK)
            while (true) {
                if (cancel.isCancelled()) throw NetException.Cancelled()
                val n = input.read(buffer)
                if (n < 0) break
                digest.update(buffer, 0, n)
                done += n
                sink.report(Progress(step, done, total))
            }
        }
    }

    private fun toHex(hash: ByteArray): String = buildString(hash.size * 2) {
        for (b in hash) {
            append(HEX[(b.toInt() shr 4) and 0xf])
            append(HEX[b.toInt() and 0xf])
        }
    }

    /** The progress step of re-reading what an earlier try left. */
    const val VERIFY = "verify"

    private const val HEX = "0123456789abcdef"
}
