package com.phonecando.linux.api

import com.phonecando.linux.LinuxHost
import com.phonecando.linux.errors.LinuxErrorCode
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException

// How a call reaches JS: a failure becomes an error whose `code` is the
// LinuxErrorCode string and whose message is the failure's own line.

/** A sync call: a failure is thrown as a CodedException (Expo keeps its code on the JS error). */
internal inline fun <T> coded(block: () -> T): T = try {
  block()
} catch (e: CodedException) {
  throw e
} catch (e: Throwable) {
  throw CodedException(LinuxErrorCode.of(e).code, LinuxErrorCode.messageOf(e), e)
}

/** An async call on our executor (not Expo's shared queue): resolves with [block]'s value or rejects with the code. */
internal fun runAsync(host: LinuxHost, promise: Promise, block: () -> Any?) {
  host.executor.execute {
    val value = try {
      block()
    } catch (e: Throwable) {
      promise.reject(LinuxErrorCode.of(e).code, LinuxErrorCode.messageOf(e), e)
      return@execute
    }
    promise.resolve(value)
  }
}
