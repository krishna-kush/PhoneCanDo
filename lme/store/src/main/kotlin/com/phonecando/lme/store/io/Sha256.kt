package com.phonecando.lme.store.io

import com.phonecando.lme.api.CancelSignal
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.Progress
import com.phonecando.lme.api.ProgressSink
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/** SHA-256 helpers: lower-case hex, cancellable over files. */
internal object Sha256 {
    const val CHUNK = 256 * 1024

    fun newDigest(): MessageDigest = MessageDigest.getInstance("SHA-256")

    fun hex(digest: MessageDigest): String = digest.digest().joinToString("") { "%02x".format(it) }

    /** Feeds all of [file] into [digest], checking [cancel] between chunks and reporting [step]. */
    fun update(digest: MessageDigest, file: File, step: String, sink: ProgressSink, cancel: CancelSignal) {
        val total = file.length()
        var done = 0L
        FileInputStream(file).use { input ->
            val buffer = ByteArray(CHUNK)
            while (true) {
                if (cancel.isCancelled()) throw LmeException.Cancelled()
                val n = input.read(buffer)
                if (n < 0) break
                digest.update(buffer, 0, n)
                done += n
                sink.report(Progress(step, done, total))
            }
        }
    }
}
