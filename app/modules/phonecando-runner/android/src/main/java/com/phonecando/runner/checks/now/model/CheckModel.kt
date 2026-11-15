package com.phonecando.runner.checks.now.model

import android.util.Log
import com.phonecando.agents.kit.ModelEndpoint
import com.phonecando.agents.kit.render.ManifestKind
import fi.iki.elonen.NanoHTTPD
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger

// The check model: a stand-in for an agent's model on loopback that answers
// every turn with "done" at once (CheckModelReplies). A Check now runs the
// agent on it when its kind takes a model (its `models` block, as for a
// local model; CheckNow.modelFor, at each start of the check's engine), so
// the check never waits on a model or depends on what one says, loads no
// model into RAM and spends nothing of your account. Started by the first
// such start, stopped once no check runs (CheckNow). It holds nothing
// secret, so it asks for no key; the one an agent is given is a placeholder.
internal object CheckModel {
  private const val TAG = "PhoneCanDoChecks"
  private const val TIMEOUT_MS = 30_000
  private const val KEY = "phonecando-check"
  private const val CONTEXT = 128_000

  /** The wire APIs it speaks, by the kit's names (ModelEndpoint.apis). */
  val APIS = listOf("openai-chat", "openai-responses", "anthropic")

  private var server: Server? = null

  /** Whether an agent of [kind] can run on it. */
  fun takes(kind: ManifestKind): Boolean = kind.modelApi(APIS) != null

  /** Where an agent of [kind] reaches it, started if need be; null when [kind] takes no model it speaks, or it can't start. */
  @Synchronized
  fun endpointFor(kind: ManifestKind): ModelEndpoint? {
    if (!takes(kind)) return null
    val running = server ?: try {
      Server().also {
        it.start(TIMEOUT_MS, true)
        server = it
      }
    } catch (e: IOException) {
      Log.w(TAG, "check model did not start; the check asks the agent's own model", e)
      return null
    }
    return ModelEndpoint("http://127.0.0.1:${running.listeningPort}", CheckModelReplies.MODEL, KEY, CONTEXT, APIS)
  }

  @Synchronized
  fun stop() {
    server?.stop()
    server = null
  }

  // Loopback, any free port; each request read whole, then answered.
  private class Server : NanoHTTPD("127.0.0.1", 0) {
    private val seq = AtomicInteger()

    override fun serve(session: IHTTPSession): Response {
      val method = session.method.name
      val body = if (method == "POST") read(session) else ""
      val reply = CheckModelReplies.reply(method, session.uri, body, seq.incrementAndGet())
      val status = if (reply.status == 200) Response.Status.OK else Response.Status.NOT_FOUND
      return newFixedLengthResponse(status, reply.mime, reply.body)
    }

    private fun read(session: IHTTPSession): String {
      val length = session.headers["content-length"]?.toIntOrNull()?.coerceIn(0, MAX_BODY) ?: return ""
      val bytes = ByteArray(length)
      var read = 0
      while (read < length) {
        val n = session.inputStream.read(bytes, read, length - read)
        if (n < 0) break
        read += n
      }
      return String(bytes, 0, read, Charsets.UTF_8)
    }

    companion object {
      private const val MAX_BODY = 32 * 1024 * 1024
    }
  }
}
