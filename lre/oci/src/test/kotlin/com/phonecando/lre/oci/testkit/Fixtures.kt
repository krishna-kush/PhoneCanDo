package com.phonecando.lre.oci.testkit

import java.security.MessageDigest

/**
 * Recorded responses under src/test/resources (registry/, catalog/). Each
 * file is the recorded body plus one final newline (our hygiene check wants
 * it); [bytes] drops that newline, giving back the exact bytes the digests
 * name.
 */
object Fixtures {
    fun bytes(path: String): ByteArray {
        val raw = Fixtures::class.java.getResourceAsStream("/$path")?.use { it.readBytes() }
            ?: error("missing fixture $path")
        return if (raw.lastOrNull() == '\n'.code.toByte()) raw.copyOf(raw.size - 1) else raw
    }

    fun text(path: String): String = bytes(path).decodeToString()

    fun sha256(bytes: ByteArray): String =
        "sha256:" + MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    // Digests of the recorded files (they are the registry's own digests).
    const val ALPINE_INDEX = "sha256:3f4d6b32e26703c6082839234f43769d5046b3ac7c910033911d1e71d8cd630a"
    const val ALPINE_ARM64 = "sha256:1829893486be257df5049ab3b7fc95afbd0fc09d89803cbc580bda1ba5386b29"
    const val ALPINE_ARM64_CONFIG = "sha256:abbc135a7d3909a5eb6a56aac4c769cf15be025e3c9e226b8660f2b2b378158b"
    const val ALPINE_ARM64_LAYER = "sha256:b90627b8f4292fd3cb63f0f27f0b11c37f04ba88ef3b78d4948ea0ace18c85e9"
    const val KALI_LIST = "sha256:7997e0581c4f5c185cfe6773d5cae8fcc7c6b79798726ccaabf843af4bcd2013"
    const val KALI_ARM64 = "sha256:5032046cc734e69016adb615ce96f52d2b5304f0b9cf1583bd2e849602da894d"
    const val KALI_ARM64_CONFIG = "sha256:1eab22b26b347dcfaf7a3992d681045116dcc62f8637881cb3ed9bb8537d6dc9"
    const val KALI_AMD64 = "sha256:73915d5d54833d498f52fd200960126be4a2dbdcc110d75d70839c4ef155ed03"
    const val KALI_AMD64_CONFIG = "sha256:a6b3ee237b3ab299648bb27097a52545a380a8b3e94b7cd53b3bc9f65aa271d9"
    const val ARCH_INDEX = "sha256:b1c2fe6e717bfd5673af8fc217e1e1c3ce0dcbb1d53c3414c8425e7ce79fc6d9"

    const val OCI_INDEX = "application/vnd.oci.image.index.v1+json"
    const val OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json"
    const val DOCKER_LIST = "application/vnd.docker.distribution.manifest.list.v2+json"
    const val DOCKER_MANIFEST = "application/vnd.docker.distribution.manifest.v2+json"
}
