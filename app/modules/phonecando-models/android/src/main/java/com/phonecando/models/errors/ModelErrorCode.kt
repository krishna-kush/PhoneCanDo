package com.phonecando.models.errors

import com.phonecando.lme.api.LmeException
import java.io.IOException

/**
 * The stable error codes JS sees (ModelErrorCode in
 * app/src/engine/models/types.ts): a rejected promise's `code`, a thrown
 * error's `code`, and `errorCode` on a job's last event. Pure.
 */
enum class ModelErrorCode(val code: String) {
  INVALID_GGUF("invalid_gguf"),
  TOO_LARGE("too_large"),
  INVALID_NAME("invalid_name"),
  EXISTS("exists"),
  NO_SPACE("no_space"),
  SIZE_MISMATCH("size_mismatch"),
  DIGEST_MISMATCH("digest_mismatch"),
  NETWORK("network"),
  RATE_LIMITED("rate_limited"),
  NOT_FOUND("not_found"),
  ACCESS_DENIED("access_denied"),
  CORRUPT("corrupt"),
  UNSUPPORTED_DEVICE("unsupported_device"),
  NOT_ENOUGH_MEMORY("not_enough_memory"),
  SERVER_NOT_READY("server_not_ready"),
  CANCELLED("cancelled"),

  /** A job already runs for that model or download. */
  BUSY("busy"),

  /** Not a Hugging Face token we keep (blank, too long, spaces). */
  INVALID_TOKEN("invalid_token"),

  /** The system file picker could not open (no activity in front, none installed). */
  PICKER_UNAVAILABLE("picker_unavailable"),
  INTERNAL("internal"),
  ;

  companion object {
    /** The code for any failure: ours, lme's, or a disk error. */
    fun of(e: Throwable): ModelErrorCode = when (e) {
      is ModelError -> e.code
      is LmeException -> ofLme(e)
      is InterruptedException -> CANCELLED
      is IOException -> if (isNoSpace(e)) NO_SPACE else INTERNAL
      else -> INTERNAL
    }

    // Exhaustive on purpose: a new LmeException subclass fails the build here.
    private fun ofLme(e: LmeException): ModelErrorCode = when (e) {
      is LmeException.InvalidGguf -> INVALID_GGUF
      is LmeException.TooLarge -> TOO_LARGE
      is LmeException.InvalidName -> INVALID_NAME
      is LmeException.Exists -> EXISTS
      is LmeException.NoSpace -> NO_SPACE
      is LmeException.SizeMismatch -> SIZE_MISMATCH
      is LmeException.DigestMismatch -> DIGEST_MISMATCH
      is LmeException.Network -> NETWORK
      is LmeException.RateLimited -> RATE_LIMITED
      is LmeException.NotFound -> NOT_FOUND
      is LmeException.AccessDenied -> ACCESS_DENIED
      is LmeException.Corrupt -> CORRUPT
      is LmeException.UnsupportedDevice -> UNSUPPORTED_DEVICE
      is LmeException.NotEnoughMemory -> NOT_ENOUGH_MEMORY
      is LmeException.ServerNotReady -> SERVER_NOT_READY
      is LmeException.Cancelled -> CANCELLED
    }

    // A full disk surfaces as a plain IOException ("ENOSPC (No space left on device)").
    private fun isNoSpace(e: IOException): Boolean {
      val text = e.message.orEmpty()
      return "ENOSPC" in text || "No space left" in text
    }

    /** The failure's own message, else its class name. lme messages never hold a secret. */
    fun messageOf(e: Throwable): String = e.message?.takeIf { it.isNotBlank() } ?: e.javaClass.simpleName
  }
}

/** A failure of ours with its code (busy, invalid_token, picker_unavailable). */
class ModelError(val code: ModelErrorCode, message: String) : Exception(message)
