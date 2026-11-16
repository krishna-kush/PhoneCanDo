package com.phonecando.runner.models.chats

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

// The model server's slot saved to and loaded from a file in its
// `--slot-save-path` dir: POST /slots/0?action=save|restore with
// {"filename"}, with the server's key. One slot (`--parallel 1`): the
// server waits for it to be free before it saves or loads. True when the
// server said it did.
internal class SlotCalls(
  private val baseUrl: String,
  private val key: String,
  private val readTimeoutMs: Int = READ_MS,
) {
  fun save(filename: String): Boolean = call("save", filename)

  fun restore(filename: String): Boolean = call("restore", filename)

  private fun call(action: String, filename: String): Boolean {
    val conn = try {
      URL("$baseUrl/slots/0?action=$action").openConnection() as HttpURLConnection
    } catch (_: IOException) {
      return false
    }
    return try {
      conn.connectTimeout = CONNECT_MS
      conn.readTimeout = readTimeoutMs
      conn.requestMethod = "POST"
      conn.doOutput = true
      conn.setRequestProperty("Authorization", "Bearer $key")
      conn.setRequestProperty("Content-Type", "application/json")
      conn.outputStream.use { it.write(JSONObject().put("filename", filename).toString().toByteArray(Charsets.UTF_8)) }
      val ok = conn.responseCode == 200
      (if (ok) conn.inputStream else conn.errorStream)?.use { it.readBytes() }
      ok
    } catch (_: IOException) {
      false
    } finally {
      conn.disconnect()
    }
  }

  companion object {
    private const val CONNECT_MS = 2_000

    /** A big chat (a 4B's 32k) takes a few seconds to write on a phone; the server first waits for its slot. */
    const val READ_MS = 120_000
  }
}
