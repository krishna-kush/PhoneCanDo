@file:OptIn(ExperimentalPceApi::class)

package com.phonecando.pce.pack

import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.getOrThrow
import java.nio.charset.StandardCharsets
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.Signature
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@OptIn(ExperimentalEncodingApi::class)
class PackManifestTest {
    @Test
    fun verifiesAndParsesManifest() {
        val json = manifestJson()

        val manifest = PackManifest.verify(json, sign(json), keyPair.public).getOrThrow()

        assertEquals("com.example.pack", manifest.packs.single().id)
        assertEquals(3, manifest.packs.single().version)
    }

    @Test
    fun rejectsBadSignature() {
        val json = manifestJson()

        val result = PackManifest.verify(json, sign(json, otherKeyPair.private), keyPair.public)

        assertEquals(ErrorCode.PACK_SIGNATURE_INVALID, result.errorCode())
    }

    @Test
    fun rejectsUnsupportedSchema() {
        val json = manifestJson().replace("phonecando.manifest/v1", "phonecando.manifest/v2")

        val result = PackManifest.verify(json, sign(json), keyPair.public)

        assertEquals(ErrorCode.PACK_INCOMPATIBLE, result.errorCode())
    }

    @Test
    fun rejectsUnsafePackId() {
        val json = manifestJson().replace("\"com.example.pack\"", "\"../../escape\"")

        val result = PackManifest.verify(json, sign(json), keyPair.public)

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    @Test
    fun rejectsDuplicatePackId() {
        val entry = """
            {"id":"com.example.pack","version":3,"url":"https://example.com/p.json","sha256":"${"0".repeat(64)}","signature":"${sign("{}")}","contract":"1.0","minPce":"0.1.0"}
        """.trimIndent()
        val json = """
            {"schema":"phonecando.manifest/v1","generatedAt":"2026-10-30T00:00:00Z","packs":[$entry,$entry]}
        """.trimIndent()

        val result = PackManifest.verify(json, sign(json), keyPair.public)

        assertEquals(ErrorCode.INVALID_PACK, result.errorCode())
    }

    @Test
    fun rejectsBadHashAndUrl() {
        val hash = PackManifest.sha256Hex("{}".toByteArray())
        val badHash = manifestJson().replace(hash, "not-a-hash")
        assertEquals(
            ErrorCode.INVALID_PACK,
            PackManifest.verify(badHash, sign(badHash), keyPair.public).errorCode(),
        )

        val badUrl = manifestJson().replace("https://example.com", "file://example.com")
        assertEquals(
            ErrorCode.INVALID_PACK,
            PackManifest.verify(badUrl, sign(badUrl), keyPair.public).errorCode(),
        )
    }

    @Test
    fun checksSha256() {
        val entry = PackManifest.verify(manifestJson(), sign(manifestJson()), keyPair.public)
            .getOrThrow().packs.single()

        assertTrue(entry.matchesSha256("{}".toByteArray()))
        assertFalse(entry.matchesSha256("[]".toByteArray()))
    }

    private fun PceResult<*>.errorCode(): ErrorCode =
        (this as PceResult.Err).error.code

    private fun sign(text: String, privateKey: PrivateKey = keyPair.private): String {
        val signer = Signature.getInstance("Ed25519")
        signer.initSign(privateKey)
        signer.update(text.toByteArray(StandardCharsets.UTF_8))
        return Base64.Default.encode(signer.sign())
    }

    private fun manifestJson(): String = """
        {
          "schema": "phonecando.manifest/v1",
          "generatedAt": "2026-10-30T00:00:00Z",
          "packs": [
            {
              "id": "com.example.pack",
              "version": 3,
              "url": "https://example.com/packs/com.example.pack/3/pack.json",
              "sha256": "${PackManifest.sha256Hex("{}".toByteArray())}",
              "signature": "${sign("{}")}",
              "contract": "1.0",
              "minPce": "0.1.0"
            }
          ]
        }
    """.trimIndent()

    private companion object {
        val keyPair: KeyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
        val otherKeyPair: KeyPair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair()
    }
}
