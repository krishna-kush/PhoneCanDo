package com.phonecando.linux.images

import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.nio.file.Files

// JVM checks for image size: files counted, links never followed.
class DirSizeTest {
  @get:Rule val tmp = TemporaryFolder()

  @Test fun countsFilesInNestedDirs() {
    val root = tmp.newFolder("img")
    File(root, "a").writeBytes(ByteArray(100))
    File(root, "d/e").mkdirs()
    File(root, "d/e/b").writeBytes(ByteArray(23))
    assertEquals(123L, DirSize.of(root))
  }

  @Test fun aLinkCountsAsALinkNotItsTarget() {
    val outside = tmp.newFile("big")
    outside.writeBytes(ByteArray(10_000))
    val root = tmp.newFolder("img")
    val link = File(root, "link")
    Files.createSymbolicLink(link.toPath(), outside.toPath())
    val dirLink = File(root, "dirlink")
    Files.createSymbolicLink(dirLink.toPath(), tmp.root.toPath())
    val expected = Files.readAttributes(link.toPath(), "size", java.nio.file.LinkOption.NOFOLLOW_LINKS)["size"] as Long +
      Files.readAttributes(dirLink.toPath(), "size", java.nio.file.LinkOption.NOFOLLOW_LINKS)["size"] as Long
    assertEquals(expected, DirSize.of(root))
  }

  @Test fun aMissingDirIsZero() {
    assertEquals(0L, DirSize.of(File(tmp.root, "none")))
  }
}
