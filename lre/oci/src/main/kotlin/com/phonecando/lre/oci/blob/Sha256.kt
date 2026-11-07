package com.phonecando.lre.oci.blob

import com.phonecando.lre.api.CancelSignal
import com.phonecando.lre.api.LreException
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/** SHA-256 helpers for verifying what registries send. */
internal object Sha256 {
    fun newDigest(): MessageDigest = MessageDigest.getInstance("SHA-256")

    fun hex(bytes: ByteArray): String = toHex(newDigest().digest(bytes))

    fun toHex(hash: ByteArray): String = buildString(hash.size * 2) {
        for (b in hash) {
            append(HEX[(b.toInt() shr 4) and 0xf])
            append(HEX[b.toInt() and 0xf])
        }
    }

    /** Feeds all of [file] into [digest], checking [cancel] between chunks. */
    fun update(digest: MessageDigest, file: File, cancel: CancelSignal) {
        FileInputStream(file).use { input ->
            val buffer = ByteArray(CHUNK)
            while (true) {
                if (cancel.isCancelled()) throw LreException.Cancelled()
                val n = input.read(buffer)
                if (n < 0) break
                digest.update(buffer, 0, n)
            }
        }
    }

    fun hex(file: File, cancel: CancelSignal): String = newDigest().also { update(it, file, cancel) }.let { toHex(it.digest()) }

    private const val HEX = "0123456789abcdef"
    private const val CHUNK = 64 * 1024
}
