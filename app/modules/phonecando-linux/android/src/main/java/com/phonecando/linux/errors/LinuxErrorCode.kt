package com.phonecando.linux.errors

import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.toLre
import com.phonecando.network.NetException
import java.io.IOException

/**
 * The stable error codes JS sees (LinuxErrorCode in
 * app/src/engine/linux/types.ts): a rejected promise's `code`, a thrown
 * error's `code`, and `errorCode` on a failed record. Pure.
 */
enum class LinuxErrorCode(val code: String) {
  UNSAFE_ENTRY("unsafe_entry"),
  TOO_LARGE("too_large"),
  INVALID_REF("invalid_ref"),
  NO_SPACE("no_space"),
  DIGEST_MISMATCH("digest_mismatch"),
  NETWORK("network"),
  RATE_LIMITED("rate_limited"),
  NOT_FOUND("not_found"),
  NO_ARM64("no_arm64"),
  UNSUPPORTED_LAYER("unsupported_layer"),
  UNSUPPORTED_MANIFEST("unsupported_manifest"),
  NO_SHELL("no_shell"),
  CORRUPT("corrupt"),
  CANCELLED("cancelled"),

  /** Play, or a build without the launcher, proot or the Default image asset. */
  LINUX_UNAVAILABLE("linux_unavailable"),

  /** An env an image was made from: a reset needs its base. */
  ENV_IN_USE("env_in_use"),

  /** A job already runs for that env or image, or it is not in a state for this. */
  BUSY("busy"),

  /** A guest script (runGuestScript) exited non-zero. */
  COMMAND_FAILED("command_failed"),

  /** A guest script or command ran past its time limit and was stopped. */
  TIMED_OUT("timed_out"),
  INTERNAL("internal"),
  ;

  companion object {
    fun fromCode(code: String?): LinuxErrorCode? = entries.firstOrNull { it.code == code }

    /** The code for any failure: ours, the runtime's, our network code's (a download's wait cancelled), or a disk error. */
    fun of(e: Throwable): LinuxErrorCode = when (e) {
      is LinuxError -> e.code
      is LreException -> ofLre(e)
      is NetException -> ofLre(e.toLre())
      is InterruptedException -> CANCELLED
      is IOException -> if (isNoSpace(e)) NO_SPACE else INTERNAL
      else -> INTERNAL
    }

    // Exhaustive on purpose: a new LreException subclass fails the build here.
    private fun ofLre(e: LreException): LinuxErrorCode = when (e) {
      is LreException.UnsafeEntry -> UNSAFE_ENTRY
      is LreException.TooLarge -> TOO_LARGE
      is LreException.InvalidRef -> INVALID_REF
      is LreException.NoSpace -> NO_SPACE
      is LreException.DigestMismatch -> DIGEST_MISMATCH
      is LreException.Network -> NETWORK
      is LreException.RateLimited -> RATE_LIMITED
      is LreException.NotFound -> NOT_FOUND
      is LreException.NoArm64 -> NO_ARM64
      is LreException.UnsupportedLayer -> UNSUPPORTED_LAYER
      is LreException.UnsupportedManifest -> UNSUPPORTED_MANIFEST
      is LreException.NoShell -> NO_SHELL
      is LreException.Corrupt -> CORRUPT
      is LreException.Cancelled -> CANCELLED
    }

    // A full disk surfaces as a plain IOException ("ENOSPC (No space left on device)").
    private fun isNoSpace(e: IOException): Boolean {
      val text = e.message.orEmpty()
      return "ENOSPC" in text || "No space left" in text
    }

    /** The failure's own message, else its class name: a rejection's message (its code rides alongside). */
    fun messageOf(e: Throwable): String = e.message?.takeIf { it.isNotBlank() } ?: e.javaClass.simpleName

    /**
     * `code: message`, the `error` line of a failed record or a job's last
     * event: the JS flows read the code back out of it (codeOfText in
     * app/src/state/flows/logic/errors.ts), the screens show the detail.
     */
    fun lineOf(e: Throwable): String = line(of(e), messageOf(e))

    fun line(code: LinuxErrorCode, message: String): String = "${code.code}: $message"
  }
}

/** A failure of ours with its code (busy, env_in_use, linux_unavailable, ...). */
class LinuxError(val code: LinuxErrorCode, message: String) : Exception(message)
