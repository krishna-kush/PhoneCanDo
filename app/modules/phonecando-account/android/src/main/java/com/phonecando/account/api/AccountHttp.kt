package com.phonecando.account.api

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/** One answer from the accounts API; status 0 when none came (no network, a timeout). */
data class HttpAnswer(val status: Int, val body: String)

/**
 * Plain JSON requests to our accounts routes. Blocking: callers run it on
 * the account executor. Redirects are never followed, so a bearer token goes
 * to the URL it was meant for and nowhere else.
 */
class AccountHttp {
  fun send(url: String, method: String, body: String?, bearer: String?): HttpAnswer {
    val conn = try {
      URL(url).openConnection() as HttpURLConnection
    } catch (_: IOException) {
      return HttpAnswer(0, "")
    }
    try {
      conn.requestMethod = method
      conn.connectTimeout = CONNECT_TIMEOUT_MS
      conn.readTimeout = READ_TIMEOUT_MS
      conn.instanceFollowRedirects = false
      conn.useCaches = false
      conn.setRequestProperty("Accept", "application/json")
      conn.setRequestProperty("User-Agent", USER_AGENT)
      if (bearer != null) conn.setRequestProperty("Authorization", "Bearer $bearer")
      if (method != "GET") {
        val bytes = (body ?: "").toByteArray(Charsets.UTF_8)
        conn.doOutput = true
        conn.setFixedLengthStreamingMode(bytes.size)
        if (body != null) conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(bytes) }
      }
      val status = conn.responseCode
      val stream = if (status >= 400) conn.errorStream else conn.inputStream
      return HttpAnswer(status, stream?.use(::readCapped) ?: "")
    } catch (_: IOException) {
      return HttpAnswer(0, "")
    } finally {
      conn.disconnect()
    }
  }

  // Our answers are a few hundred bytes; anything far larger is not ours.
  // (InputStream.readNBytes is API 33+; minSdk is 29.)
  private fun readCapped(input: InputStream): String {
    val out = ByteArrayOutputStream()
    val buf = ByteArray(8192)
    while (out.size() < MAX_BODY_BYTES) {
      val n = input.read(buf, 0, minOf(buf.size, MAX_BODY_BYTES - out.size()))
      if (n < 0) break
      out.write(buf, 0, n)
    }
    return out.toString(Charsets.UTF_8.name())
  }

  private companion object {
    const val CONNECT_TIMEOUT_MS = 15_000
    const val READ_TIMEOUT_MS = 20_000
    const val MAX_BODY_BYTES = 256 * 1024
    const val USER_AGENT = "phonecando-account"
  }
}
