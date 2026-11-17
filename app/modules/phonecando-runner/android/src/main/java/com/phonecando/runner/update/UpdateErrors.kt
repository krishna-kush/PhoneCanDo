package com.phonecando.runner.update

import com.phonecando.network.NetException
import java.io.IOException

// How a failed update download reads for JS: a short code (errorCode on
// the state map, the code of a rejected call) and one line that starts
// with it ("network: network error on https://github.com/…"). network's
// messages carry redacted URLs, never a secret. Pure.
object UpdateErrors {
  const val BAD_SPEC = "bad_spec"
  const val BUSY = "busy"
  const val STOPPED = "stopped"

  private const val MAX_LINE = 300

  /** The code for any failure of a download or a start: network's, the disk's, or ours. */
  fun codeOf(e: Throwable): String = when (NetException.of(e)) {
    is NetException.Network -> "network"
    is NetException.RateLimited -> "rate_limited"
    is NetException.NotFound -> "not_found"
    is NetException.AccessDenied -> "access_denied"
    is NetException.BadAnswer -> "bad_answer"
    is NetException.SizeMismatch -> "size_mismatch"
    is NetException.DigestMismatch -> "digest_mismatch"
    is NetException.Cancelled -> "cancelled"
    null -> when (e) {
      is UpdateError -> e.code
      // A full disk surfaces as a plain IOException ("ENOSPC (No space left on device)").
      is IOException -> if (noSpace(e)) "no_space" else "storage"
      else -> "internal"
    }
  }

  /** "<code>: <message>", on one line and short. */
  fun lineOf(e: Throwable): String {
    val message = (NetException.of(e) ?: e).message?.takeIf { it.isNotBlank() } ?: e.javaClass.simpleName
    return "${codeOf(e)}: ${message.replace(Regex("\\s+"), " ").trim()}".take(MAX_LINE)
  }

  private fun noSpace(e: IOException): Boolean {
    val text = e.message.orEmpty()
    return "ENOSPC" in text || "No space left" in text
  }
}

/** A refusal of ours with its code ([UpdateErrors.BUSY], [UpdateErrors.STOPPED]). */
class UpdateError(val code: String, message: String) : Exception(message)
