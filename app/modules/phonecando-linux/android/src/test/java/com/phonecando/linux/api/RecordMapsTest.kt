package com.phonecando.linux.api

import com.phonecando.linux.records.Samples
import com.phonecando.lre.image.reset.ReinstallList
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks that what JS gets has the field names of app/src/engine/linux/types.ts.
class RecordMapsTest {
  @Test fun envHasTheEnvShape() {
    val map = Samples.envs[1].toMap()
    assertEquals(setOf("id", "name", "source", "state", "os", "sizeBytes", "createdAt", "error", "errorCode"), map.keys)
    assertEquals(
      mapOf("kind" to "registry", "image" to "kalilinux/kali-rolling", "tag" to "latest", "digest" to "sha256:" + "a".repeat(64)),
      map["source"],
    )
    assertEquals("failed", map["state"])
    assertEquals(mapOf("kind" to "default", "version" to "2026.11.06-1"), Samples.envs[0].toMap()["source"])
    assertEquals(mapOf("kind" to "android"), Samples.envs[2].toMap()["source"])
  }

  @Test fun imageHasTheImageShape() {
    val map = Samples.images[1].toMap()
    assertEquals(
      setOf("id", "envId", "state", "failedStep", "error", "errorCode", "os", "missingTools", "installCommand", "sizeBytes", "createdAt"),
      map.keys,
    )
    assertEquals("unpack", map["failedStep"])
    assertNull(map["os"])
  }

  @Test fun osHasTheOsInfoShape() {
    val map = Samples.debian.toMap()
    assertEquals(setOf("id", "versionId", "idLike", "prettyName", "family", "shell"), map.keys)
    assertEquals("apt", map["family"])
    assertNull(Samples.bare.toMap()["family"])
  }

  @Test fun reinstallListHasItsShape() {
    assertEquals(
      mapOf("installCommand" to "apt-get install -y jq", "packages" to listOf("jq")),
      ReinstallList("apt-get install -y jq", listOf("jq")).toMap(),
    )
  }
}
