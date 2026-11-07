package com.phonecando.linux.registry

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.registry.LayerDescriptor
import com.phonecando.lre.oci.registry.ResolvedImage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

// JVM checks for a registry env's saved base and the {image, tag} we parse.
class EnvBaseTest {
  private val digest = "sha256:" + "b".repeat(64)

  private val resolved = ResolvedImage(
    ref = ImageRef.parse("kalilinux/kali-rolling:latest"),
    manifestDigest = digest,
    config = ImageConfig(listOf("PATH=/usr/bin:/bin", "LANG=C.UTF-8"), "/root", null, emptyList(), listOf("bash")),
    layers = listOf(
      LayerDescriptor("sha256:" + "1".repeat(64), 1234, "application/vnd.oci.image.layer.v1.tar+gzip", Compression.GZIP),
      LayerDescriptor("sha256:" + "2".repeat(64), 99, "application/vnd.oci.image.layer.v1.tar+zstd", Compression.ZSTD),
    ),
    sourceHost = "registry-1.docker.io",
  )

  @Test fun theResolvedImageRoundTrips() {
    assertEquals(resolved, EnvBase.decode(EnvBase.encode(resolved)))
  }

  @Test fun aPinnedReferenceRoundTrips() {
    val pinned = resolved.copy(ref = resolved.ref.withDigest(digest))
    assertEquals(pinned, EnvBase.decode(EnvBase.encode(pinned)))
  }

  @Test fun garbageIsNoBase() {
    assertNull(EnvBase.decode("{}"))
    assertNull(EnvBase.decode("not json"))
  }

  @Test fun tagsAreJoinedTheWayDockerPullReadsThem() {
    assertEquals("3.22", RegistryRef.parse("alpine", "3.22").tag)
    assertEquals("library/alpine", RegistryRef.parse(" alpine ", "").repository)
    assertEquals("latest", RegistryRef.parse("alpine", "").tag)
    assertEquals(digest, RegistryRef.parse("alpine", digest).digest)
    assertEquals("ghcr.io", RegistryRef.parse("ghcr.io/owner/name", "v1").registry)
  }

  @Test fun aBadReferenceIsInvalidRef() {
    try {
      RegistryRef.parse("Not An Image", "latest")
      fail("expected InvalidRef")
    } catch (_: LreException.InvalidRef) {
    }
  }

  @Test fun theDisplayNameIsWhatTheUserPicked() {
    assertEquals("alpine:3.22", RegistryRef.displayName("alpine", "3.22"))
    assertEquals("alpine", RegistryRef.displayName("alpine", " "))
    assertEquals("alpine@sha256:bbbbbbbbbbbb", RegistryRef.displayName("alpine", digest))
  }
}
