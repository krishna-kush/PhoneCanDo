package com.phonecando.network.http

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import kotlin.test.assertEquals

/** Against the JDK's own HTTP server on loopback: no network, no HTTP library. */
class UrlConnectionPortTest {
    private val server = HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0).apply {
        createContext("/ok") { exchange ->
            val body = "range=${exchange.requestHeaders.getFirst("Range")} enc=${exchange.requestHeaders.getFirst("Accept-Encoding")}"
                .toByteArray()
            exchange.responseHeaders.add("X-Linked-Size", "42")
            exchange.sendResponseHeaders(206, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        createContext("/moved") { exchange ->
            exchange.responseHeaders.add("Location", "/ok")
            exchange.sendResponseHeaders(302, -1)
            exchange.close()
        }
        createContext("/missing") { exchange ->
            val body = "no such file".toByteArray()
            exchange.sendResponseHeaders(404, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        start()
    }
    private val base = "http://127.0.0.1:${server.address.port}"
    private val port = UrlConnectionPort()

    @AfterEach
    fun stop() = server.stop(0)

    @Test
    fun `a GET sends our headers and returns status, headers and body`() {
        port.get("$base/ok", mapOf("Range" to "bytes=3-")).use {
            assertEquals(206, it.status)
            assertEquals("42", it.header("x-linked-size"))
            assertEquals("range=bytes=3- enc=identity", it.body.readBytes().decodeToString())
        }
    }

    @Test
    fun `a redirect comes back as is`() {
        port.get("$base/moved", emptyMap()).use {
            assertEquals(302, it.status)
            assertEquals("/ok", it.header("Location"))
        }
    }

    @Test
    fun `an error status streams the error body`() {
        port.get("$base/missing", emptyMap()).use {
            assertEquals(404, it.status)
            assertEquals("no such file", it.body.readBytes().decodeToString())
        }
    }

    @Test
    fun `no listener is an IOException`() {
        server.stop(0)
        assertThrows<IOException> { port.get("$base/ok", emptyMap()) }
        assertThrows<IOException> { port.get("not a url", emptyMap()) }
    }
}
