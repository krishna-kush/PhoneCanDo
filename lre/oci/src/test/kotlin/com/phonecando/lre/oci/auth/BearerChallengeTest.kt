package com.phonecando.lre.oci.auth

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class BearerChallengeTest {
    @Test
    fun `parses Docker Hub's challenge as recorded`() {
        val header = """Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/alpine:pull""""
        assertEquals(
            BearerChallenge("https://auth.docker.io/token", "registry.docker.io", "repository:library/alpine:pull"),
            BearerChallenge.parse(header),
        )
    }

    @Test
    fun `parses ECR's and ghcr's shapes`() {
        assertEquals(
            BearerChallenge("https://public.ecr.aws/token/", "public.ecr.aws", "aws"),
            BearerChallenge.parse("""Bearer realm="https://public.ecr.aws/token/",service="public.ecr.aws",scope="aws""""),
        )
        assertEquals(
            BearerChallenge("https://ghcr.io/token", "ghcr.io", "repository:a/b:pull,push"),
            BearerChallenge.parse("""bearer realm = "https://ghcr.io/token", service="ghcr.io", scope="repository:a/b:pull,push""""),
        )
    }

    @Test
    fun `handles escapes, bare tokens and several challenges`() {
        assertEquals(
            BearerChallenge("https://r.example/t", "svc", null),
            BearerChallenge.parse("""Basic realm="x", Bearer realm="https://r.example/t",service=svc, error="insufficient_scope""""),
        )
        assertEquals("a\"b", BearerChallenge.parse("""Bearer realm="https://x", service="a\"b"""")?.service)
        assertEquals(
            BearerChallenge("https://x", null, null),
            BearerChallenge.parse("""Bearer realm="https://x", Basic realm="y""""),
        )
    }

    @Test
    fun `no Bearer or no realm is no challenge`() {
        assertNull(BearerChallenge.parse(null))
        assertNull(BearerChallenge.parse(""))
        assertNull(BearerChallenge.parse("""Basic realm="registry""""))
        assertNull(BearerChallenge.parse("""Bearer service="x""""))
        assertNull(BearerChallenge.parse("""Bearer realm="""""))
    }
}
