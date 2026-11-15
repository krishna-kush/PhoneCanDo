package com.phonecando.runner.engine.acp

import android.util.Log
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.atomic.AtomicLong

// JSON-RPC with one ACP agent over its stdout ([input]) and stdin
// ([output]), one message per line (AcpWire). One reader thread hands each
// answer to the call that waits for it, the agent's requests to
// [onRequest] and its notices to [onNotification], all on that thread, so
// none of them may wait for an answer. Writes are one at a time. A call
// with a timeout fails with no answer by then; once the agent's output
// ends (it exited, or we closed it) every open call fails and [onClosed]
// runs. Never logs what a message carries: requests hold the bridge token.
internal class AcpConnection(
  private val input: InputStream,
  private val output: OutputStream,
  private val name: String,
  private val onRequest: (AcpWire.Request) -> Unit,
  private val onNotification: (AcpWire.Notification) -> Unit,
  private val onClosed: () -> Unit,
) : AcpRpc {
  private class Pending(val method: String, val onResult: (JSONObject) -> Unit, val onError: (AcpError) -> Unit) {
    @Volatile var timeout: ScheduledFuture<*>? = null
  }

  private val pending = ConcurrentHashMap<Long, Pending>()
  private val ids = AtomicLong()
  private val writeLock = Any()

  @Volatile private var closed = false

  fun start() {
    Thread({ read() }, "phonecando-acp-$name").apply {
      isDaemon = true
      start()
    }
  }

  /** Sends [method]; one of the callbacks runs once (on the reader or timer thread). [timeoutMs] 0: no timeout. */
  fun call(method: String, params: JSONObject, timeoutMs: Long, onResult: (JSONObject) -> Unit, onError: (AcpError) -> Unit) {
    val id = ids.incrementAndGet()
    val call = Pending(method, onResult, onError)
    pending[id] = call
    if (timeoutMs > 0) {
      val late = Runnable {
        pending.remove(id)?.let { finish(it) { it.onError(AcpError(AcpWire.TIMED_OUT, "no answer in ${timeoutMs / 1000} s")) } }
      }
      call.timeout = AcpTimers.after(timeoutMs, late)
    }
    if (!write(AcpWire.request(id, method, params))) {
      pending.remove(id)?.let { finish(it) { it.onError(GONE) } }
    }
  }

  override fun request(method: String, params: JSONObject, timeoutMs: Long): JSONObject {
    val done = CountDownLatch(1)
    var answer: JSONObject? = null
    var error: AcpError? = null
    call(method, params, timeoutMs, {
      answer = it
      done.countDown()
    }, {
      error = it
      done.countDown()
    })
    done.await()
    error?.let { throw AcpException(method, it) }
    return answer ?: JSONObject()
  }

  fun notify(method: String, params: JSONObject) {
    write(AcpWire.notification(method, params))
  }

  /** Answers the agent's request [id]. */
  fun reply(id: Any, result: JSONObject) {
    write(AcpWire.result(id, result))
  }

  fun replyError(id: Any, code: Int, message: String) {
    write(AcpWire.error(id, code, message))
  }

  /** Closes the agent's stdin (many agents end then) and fails every open call. */
  fun close() {
    synchronized(writeLock) {
      closed = true
      try {
        output.close()
      } catch (_: IOException) {
      }
    }
    failAll()
  }

  private fun write(line: String): Boolean = synchronized(writeLock) {
    if (closed) return false
    try {
      output.write(line.toByteArray(Charsets.UTF_8))
      output.write('\n'.code)
      output.flush()
      true
    } catch (_: IOException) {
      false
    }
  }

  private fun read() {
    val lines = AcpWire.Lines()
    val buf = CharArray(READ_CHARS)
    try {
      InputStreamReader(input, Charsets.UTF_8).use { reader ->
        while (true) {
          val n = reader.read(buf)
          if (n < 0) break
          lines.feed(buf, n, ::dispatch)
        }
      }
    } catch (_: IOException) {
      // The pipe broke: the agent is gone.
    }
    closed = true
    failAll()
    safely(onClosed)
  }

  private fun dispatch(line: String) {
    if (line.isBlank()) return
    when (val message = AcpWire.parse(line)) {
      is AcpWire.Response -> pending.remove(message.id)?.let { call ->
        finish(call) {
          val error = message.error
          if (error != null) call.onError(error) else call.onResult(message.result)
        }
      }
      is AcpWire.Request -> safely { onRequest(message) }
      is AcpWire.Notification -> safely { onNotification(message) }
      null -> {}
    }
  }

  private fun failAll() {
    for (id in pending.keys.toList()) pending.remove(id)?.let { finish(it) { it.onError(GONE) } }
  }

  private fun finish(call: Pending, block: () -> Unit) {
    call.timeout?.cancel(false)
    safely(block)
  }

  // A handler's failure must not end the reader; its message may carry
  // what the agent sent, so only its type is logged.
  private fun safely(block: () -> Unit) {
    try {
      block()
    } catch (t: Throwable) {
      Log.w(TAG, "ACP handler of $name failed: ${t.javaClass.simpleName}")
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoAcp"
    const val READ_CHARS = 8192

    val GONE = AcpError(AcpWire.GONE, "the agent is not running")
  }
}
