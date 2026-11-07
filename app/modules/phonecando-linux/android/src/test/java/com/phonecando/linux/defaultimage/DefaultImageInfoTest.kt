package com.phonecando.linux.defaultimage

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the staged image.json (lre/images/default/lock/stage.sh).
class DefaultImageInfoTest {
  @Test fun readsWhatStageWrites() {
    val text = """{"version":"2026.11.06-1","sha256":"${"c".repeat(64)}","size":61234567,"release":"default-image-2026.11.06-1","debian_digest":"sha256:x","snapshot":"20261106T000000Z"}"""
    assertEquals(
      DefaultImageInfo("2026.11.06-1", "c".repeat(64), 61_234_567L, "default-image-2026.11.06-1"),
      DefaultImageInfo.parse(text),
    )
  }

  @Test fun anUnlockedImageIsNoImage() {
    assertNull(DefaultImageInfo.parse("""{"version":null,"sha256":null,"size":null}"""))
    assertNull(DefaultImageInfo.parse("garbage"))
  }
}
