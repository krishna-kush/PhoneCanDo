package com.phonecando.runner.models.chats

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.Socket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

// The go-between against a stand-in llama-server: answers pass through
// unchanged as they stream, one model request at a time, chats saved and
// loaded back as they take turns, a client that leaves stops the server's
// work, and a chat that will not load is read again.
class ChatRelayTest {
  @get:Rule val tmp = TemporaryFolder()

  private val key = "k".repeat(48)
  private val chats by lazy { File(tmp.root, ".chats").also { it.mkdirs() } }
  private val server by lazy { FakeLlamaServer(chats, key) }
  private val relay by lazy {
    val files = ChatFiles(chats, 1, { Long.MAX_VALUE }).also { it.prepare("s") }
    val slots = SlotCalls("http://127.0.0.1:${server.port}", key)
    ChatRelay(server.port, key, ChatSwitch(files, slots::save, slots::restore)).start(0)
  }

  @After fun close() {
    relay.close()
    server.close()
  }

  private fun chat(system: String, first: String) =
    """{"model":"m","stream":true,"messages":[{"role":"system","content":"$system"},{"role":"user","content":"$first"}]}"""

  private fun request(body: String, path: String = "/v1/chat/completions", auth: String = "Authorization: Bearer $key", method: String = "POST"): Socket {
    val s = Socket("127.0.0.1", relay.port)
    val bytes = body.toByteArray()
    val head = "$method $path HTTP/1.1\r\nHost: x\r\n$auth\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: keep-alive\r\n\r\n"
    s.getOutputStream().write(head.toByteArray() + bytes)
    s.getOutputStream().flush()
    return s
  }

  private fun Socket.answer(): String = use { String(it.getInputStream().readBytes(), Charsets.UTF_8) }

  @Test fun anAnswerStreamsBackUnchanged() {
    val text = request(chat("S", "hi")).answer()
    assertTrue(text, text.startsWith("HTTP/1.1 200 OK\r\n"))
    assertTrue(text.contains("Transfer-Encoding: chunked"))
    assertTrue(text.contains("data: {\"n\":1}\n\n") && text.contains("data: {\"n\":3}\n\n"))
    assertTrue(text.endsWith("0\r\n\r\n"))
    // The server got the same request, with its own length, closing after.
    val got = server.modelRequests().single()
    assertEquals(chat("S", "hi"), got.body)
    assertEquals("close", got.headers["connection"])
    assertEquals("Bearer $key", got.headers["authorization"])
    // Other routes pass too, and so does a request without the key (the server refuses it itself).
    assertTrue(request("", "/v1/models", method = "GET").answer().contains("\"id\":\"m\""))
    assertTrue(request(chat("S", "hi"), auth = "X-Other: 1").answer().startsWith("HTTP/1.1 401"))
    assertEquals(emptyList<String>(), server.slotCalls())
  }

  @Test fun chatsTakingTurnsAreSavedAndLoadedBack() {
    request(chat("S", "a")).answer()
    request(chat("S", "a")).answer()
    assertEquals(emptyList<String>(), server.slotCalls())
    request(chat("Helper", "b")).answer()
    request(chat("S", "a")).answer()
    val a = ChatKeys.key(ChatKeys.Api.OPENAI_CHAT, chat("S", "a"))
    val b = ChatKeys.key(ChatKeys.Api.OPENAI_CHAT, chat("Helper", "b"))
    assertEquals(listOf("save $a.tmp", "save $b.tmp", "restore $a.bin"), server.slotCalls())
    assertTrue(File(chats, "$a.bin").isFile && File(chats, "$b.bin").isFile)
    assertFalse(File(chats, "$a.tmp").exists())
  }

  @Test fun oneModelRequestAtATimeAndAClientThatLeavesStopsTheServersWork() {
    server.finish = CountDownLatch(1)
    val first = request(chat("S", "a"))
    // The first streams, held before its end; the second waits for the slot.
    val head = ByteArray(16)
    first.getInputStream().read(head)
    val second = thread { request(chat("S", "b")).answer() }
    Thread.sleep(600)
    assertEquals(1, server.modelRequests().size)
    // The first client leaves: the server's side closes, the slot is free, the second runs.
    first.close()
    assertTrue(server.cancelled.await(5, TimeUnit.SECONDS))
    server.finish.countDown()
    second.join(5_000)
    assertFalse(second.isAlive)
    assertEquals(2, server.modelRequests().size)
  }

  @Test fun aChatThatWillNotLoadIsReadAgain() {
    request(chat("S", "a")).answer()
    request(chat("S", "b")).answer()
    server.restoreOk = false
    val text = request(chat("S", "a")).answer()
    assertTrue(text.startsWith("HTTP/1.1 200 OK"))
    val a = ChatKeys.key(ChatKeys.Api.OPENAI_CHAT, chat("S", "a"))
    assertTrue(server.slotCalls().contains("restore $a.bin"))
    assertFalse(File(chats, "$a.bin").exists())
    assertEquals(3, server.modelRequests().size)
  }

  @Test fun aChunkedBodyGoesOnWhole() {
    val s = Socket("127.0.0.1", relay.port)
    val body = chat("S", "a")
    val head = "POST /v1/chat/completions HTTP/1.1\r\nAuthorization: Bearer $key\r\nTransfer-Encoding: chunked\r\n\r\n"
    val chunks = "5\r\n${body.take(5)}\r\n${Integer.toHexString(body.length - 5)}\r\n${body.drop(5)}\r\n0\r\n\r\n"
    s.getOutputStream().write((head + chunks).toByteArray())
    assertTrue(s.answer().startsWith("HTTP/1.1 200 OK"))
    assertEquals(body, server.modelRequests().single().body)
  }
}
