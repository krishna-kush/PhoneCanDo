package com.phonecando.runner.models.chats

import com.phonecando.lme.host.chats.StoredChats
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermissions

class ChatFilesTest {
  @get:Rule val tmp = TemporaryFolder()

  private var now = 1_000_000L
  private var free = 100L shl 30

  private fun files(dir: File = File(tmp.root, ".chats"), chatBytes: Long = 10) = ChatFiles(dir, chatBytes, { free }, { now })

  // What the server does on a save: it writes the temp name in the dir it was given, world-readable.
  private fun serverSaves(f: ChatFiles, key: String, bytes: Int = 10) {
    File(f.dir, f.tempName(key)).writeBytes(ByteArray(bytes))
  }

  private fun perms(f: File) = PosixFilePermissions.toString(Files.getPosixFilePermissions(f.toPath()))

  @Test fun aSaveBecomesThePrivateNewestFileAndTheOldestGoPastTheCap() {
    val f = files()
    f.prepare("shape-1")
    assertEquals("rwx------", perms(f.dir))
    val keys = (1..StoredChats.MOST + 1).map { "k$it" }
    for (key in keys) {
      now += 1_000
      serverSaves(f, key)
      assertTrue(f.commit(key))
      assertEquals("rw-------", perms(File(f.dir, f.savedName(key))))
    }
    assertFalse(f.has("k1"))
    assertTrue(keys.drop(1).all(f::has))
    // A chat loaded back is the newest: the next one past the cap takes the oldest of the rest.
    now += 1_000
    f.used("k2")
    now += 1_000
    serverSaves(f, "k9")
    f.commit("k9")
    assertTrue(f.has("k2"))
    assertFalse(f.has("k3"))
  }

  @Test fun anotherShapeEmptiesTheDirAndACutSaveLeavesNothing() {
    val f = files()
    f.prepare("shape-1")
    serverSaves(f, "a")
    f.commit("a")
    serverSaves(f, "b")
    f.prepare("shape-1")
    assertTrue(f.has("a"))
    assertFalse(File(f.dir, f.tempName("b")).exists())
    f.prepare("shape-2")
    assertFalse(f.has("a"))
    assertEquals("shape-2", File(f.dir, ChatFiles.SHAPE).readText())
    // A failed save leaves nothing; a commit with nothing saved does nothing.
    serverSaves(f, "c")
    f.abandon("c")
    assertFalse(f.commit("c"))
    assertFalse(f.has("c"))
  }

  @Test fun beforeASaveTheOldestGoToKeepTheMarginFree() {
    val f = files(chatBytes = 1L shl 20)
    f.prepare("s")
    for (key in listOf("a", "b")) {
      now += 1_000
      serverSaves(f, key, 1 shl 20)
      f.commit(key)
    }
    // Room for one more chat above the margin once one old one goes.
    free = StoredChats.FREE_MARGIN_BYTES
    assertTrue(f.makeRoom())
    assertFalse(f.has("a"))
    assertTrue(f.has("b"))
    // Nothing left to make room with: no save.
    free = 0
    assertFalse(f.makeRoom())
    assertFalse(f.has("b"))
  }
}
