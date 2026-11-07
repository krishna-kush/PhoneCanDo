package com.phonecando.lre.oci.ref

import com.phonecando.lre.api.LreException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ImageRefTest {
    private val sha = "sha256:" + "ab".repeat(32)

    private data class Case(val input: String, val registry: String, val repository: String, val tag: String?, val digest: String? = null)

    private val hub = ImageRef.DOCKER_HUB

    @Test
    fun `parses what people type`() {
        val cases = listOf(
            Case("alpine", hub, "library/alpine", "latest"),
            Case("alpine:3.22", hub, "library/alpine", "3.22"),
            Case("library/alpine:3.22", hub, "library/alpine", "3.22"),
            Case("kalilinux/kali-rolling", hub, "kalilinux/kali-rolling", "latest"),
            Case("docker.io/alpine", hub, "library/alpine", "latest"),
            Case("index.docker.io/library/debian:trixie-slim", hub, "library/debian", "trixie-slim"),
            Case("registry-1.docker.io/kalilinux/kali-rolling:arm64", hub, "kalilinux/kali-rolling", "arm64"),
            Case("ghcr.io/owner/name:tag", "ghcr.io", "owner/name", "tag"),
            Case("ghcr.io/owner/group/name", "ghcr.io", "owner/group/name", "latest"),
            Case("quay.io/x/y@$sha", "quay.io", "x/y", null, sha),
            Case("alpine:3.22@$sha", hub, "library/alpine", "3.22", sha),
            Case("localhost:5000/x", "localhost:5000", "x", "latest"),
            Case("localhost/x:1", "localhost", "x", "1"),
            Case("Registry.Example.com:8443/team/app:v1.2_rc-3", "registry.example.com:8443", "team/app", "v1.2_rc-3"),
            Case("  ubuntu:24.04  ", hub, "library/ubuntu", "24.04"),
            Case("my_org/my__app.v2-x", hub, "my_org/my__app.v2-x", "latest"),
        )
        for (case in cases) {
            val ref = ImageRef.parse(case.input)
            assertEquals(case.registry, ref.registry, case.input)
            assertEquals(case.repository, ref.repository, case.input)
            assertEquals(case.tag, ref.tag, case.input)
            assertEquals(case.digest, ref.digest, case.input)
        }
    }

    @Test
    fun `rejects garbage with a typed error`() {
        val bad = listOf(
            "", "   ", "Alpine", "alpine:", "alpine::1", "foo bar", "https://ghcr.io/x/y",
            "alpine@sha256:abc", "alpine@md5:" + "ab".repeat(16), "alpine@" + sha.uppercase(),
            "ghcr.io/", "a//b", "-alpine", "alpine-", "ghcr.io/Owner/name", "alpine:" + "a".repeat(129),
            "alpine:-x", "a".repeat(600), "bad_host!/x", "/alpine",
        )
        for (input in bad) {
            val e = assertThrows<LreException.InvalidRef>(input) { ImageRef.parse(input) }
            assertEquals(input, e.input)
            assertTrue(e.reason.isNotEmpty())
        }
    }

    @Test
    fun `reference, scheme and canonical form`() {
        val pinned = ImageRef.parse("quay.io/x/y:1@$sha")
        assertEquals(sha, pinned.reference)
        assertEquals("quay.io/x/y:1@$sha", pinned.toString())
        assertEquals("https", pinned.scheme)

        val alpine = ImageRef.parse("alpine")
        assertTrue(alpine.isDockerHub)
        assertEquals("latest", alpine.reference)
        assertEquals("docker.io/library/alpine:latest", alpine.toString())
        assertEquals(sha, alpine.withDigest(sha).reference)

        assertFalse(ImageRef.parse("ghcr.io/a/b").isDockerHub)
        assertEquals("http", ImageRef.parse("localhost:5000/x").scheme)
        assertEquals("http", ImageRef.parse("127.0.0.1:5000/x").scheme)
        assertEquals("http", ImageRef.parse("[::1]:5000/x").scheme)
        assertEquals("https", ImageRef.parse("localhost.example.com/x").scheme)
    }
}
