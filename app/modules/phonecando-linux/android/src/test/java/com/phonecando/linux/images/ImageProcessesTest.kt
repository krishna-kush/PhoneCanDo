package com.phonecando.linux.images

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the image reaper's pure part: which processes belong to an
// image, and reading the tag and status the way /proc writes them.
class ImageProcessesTest {
  private val root = "/data/user/0/pkg/files/images/ab12cd"
  private val me = 1000
  private val uid = 10416

  private fun entry(pid: Int, image: String?, uid: Int = this.uid, zombie: Boolean = false) =
    ImageProcesses.Entry(pid, uid, zombie, image)

  @Test fun selectsOnlyOurLiveProcessesOfThatImage() {
    val entries = listOf(
      entry(1, root),
      entry(2, "$root-other"),
      entry(3, "/data/user/0/pkg/files/images/zz99zz"),
      entry(4, root, uid = 2000),
      entry(5, root, zombie = true),
      entry(me, root),
      entry(6, null),
    )
    assertEquals(listOf(1), ImageProcesses.select(entries, root, me, uid))
  }

  @Test fun readsTheTagFromEnviron() {
    val environ = "HOME=/root\u0000PHONECANDO_IMAGE=$root\u0000PHONECANDO_IMAGE=/second\u0000".toByteArray()
    assertEquals(root, ImageProcesses.tagOf(environ))
    assertNull(ImageProcesses.tagOf("PHONECANDO_IMAGES=x\u0000PATH=/bin".toByteArray()))
    assertNull(ImageProcesses.tagOf(ByteArray(0)))
  }

  @Test fun parsesUidAndZombieFromStatus() {
    assertEquals(10416 to false, ImageProcesses.parseStatus("Name:\tsleep\nState:\tS (sleeping)\nUid:\t10416\t10416\t10416\t10416\n"))
    assertEquals(10416 to true, ImageProcesses.parseStatus("State:\tZ (zombie)\nUid:\t10416\t10416\t10416\t10416\n"))
    assertNull(ImageProcesses.parseStatus("Name:\tx\n"))
  }
}
