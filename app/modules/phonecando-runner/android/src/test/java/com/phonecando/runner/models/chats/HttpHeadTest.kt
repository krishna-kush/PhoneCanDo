package com.phonecando.runner.models.chats

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HttpHeadTest {
  private val key = "k".repeat(48)
  private val text = "POST /v1/messages?beta=true HTTP/1.1\r\nHost: 127.0.0.1:9\r\nx-api-key: $key\r\nContent-Type: application/json\r\n" +
    "Content-Length: 12\r\nConnection: keep-alive\r\nExpect: 100-continue\r\n\r\n"

  @Test fun readsTheRequestLineAndHeadersAsSent() {
    val head = HttpHead.parse(text)!!
    assertEquals("POST", head.method)
    assertEquals("/v1/messages", head.path)
    assertEquals(12L, head.contentLength)
    assertTrue(head.expectsContinue)
    assertFalse(head.chunked)
    assertEquals("application/json", head.header("content-type"))
  }

  @Test fun theServersKeyAsEitherHeaderCarries() {
    assertTrue(HttpHead.parse(text)!!.carries(key))
    assertFalse(HttpHead.parse(text)!!.carries("other"))
    assertTrue(HttpHead.parse("GET / HTTP/1.1\r\nAuthorization: Bearer $key\r\n\r\n")!!.carries(key))
    assertFalse(HttpHead.parse("GET / HTTP/1.1\r\n\r\n")!!.carries(key))
  }

  @Test fun upstreamItClosesAfterTheAnswerAndSaysTheWholeBodysLength() {
    val chunked = HttpHead.parse("POST /v1/chat/completions HTTP/1.1\r\nHost: h\r\nTransfer-Encoding: chunked\r\nAuthorization: Bearer x\r\n\r\n")!!
    assertTrue(chunked.chunked)
    assertEquals(
      "POST /v1/chat/completions HTTP/1.1\r\nHost: h\r\nAuthorization: Bearer x\r\nContent-Length: 5\r\nConnection: close\r\n\r\n",
      String(chunked.upstream(5), Charsets.ISO_8859_1),
    )
    assertEquals(
      "POST /v1/messages?beta=true HTTP/1.1\r\nHost: 127.0.0.1:9\r\nx-api-key: $key\r\nContent-Type: application/json\r\nContent-Length: 12\r\nConnection: close\r\n\r\n",
      String(HttpHead.parse(text)!!.upstream(12), Charsets.ISO_8859_1),
    )
    assertEquals("GET /v1/models HTTP/1.1\r\nConnection: close\r\n\r\n", String(HttpHead.parse("GET /v1/models HTTP/1.1\r\n\r\n")!!.upstream(null), Charsets.ISO_8859_1))
  }

  @Test fun notAHead() {
    assertNull(HttpHead.parse(""))
    assertNull(HttpHead.parse("GET /\r\n\r\n"))
    assertNull(HttpHead.parse("GET / SPDY/3\r\n\r\n"))
    assertNull(HttpHead.parse("GET / HTTP/1.1\r\nno colon\r\n\r\n"))
    assertEquals(-1L, HttpHead.parse("POST / HTTP/1.1\r\nContent-Length: x\r\n\r\n")!!.contentLength)
  }
}
