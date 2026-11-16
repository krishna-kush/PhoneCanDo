package com.phonecando.runner.models.chats

import com.phonecando.runner.models.chats.ChatKeep.Saved
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatKeepTest {
  private val saved = listOf(Saved("c.bin", 30, 100), Saved("a.bin", 10, 100), Saved("d.bin", 40, 100), Saved("b.bin", 20, 100), Saved("e.bin", 50, 100))

  @Test fun theNewestStayAndTheOldestGoPastTheCap() {
    assertEquals(listOf("a.bin"), ChatKeep.overCap(saved, 4))
    assertEquals(listOf("a.bin", "b.bin", "c.bin"), ChatKeep.overCap(saved, 2))
    assertEquals(emptyList<String>(), ChatKeep.overCap(saved, 5))
  }

  @Test fun beforeASaveTheOldestGoUntilTheMarginStaysFree() {
    // 1,000 free, a chat of up to 200, 900 to keep: the oldest (100) goes; 950 free: two go.
    assertEquals(ChatKeep.Room(listOf("a.bin"), true), ChatKeep.room(saved, 1_000, 200, 900))
    assertEquals(ChatKeep.Room(listOf("a.bin", "b.bin"), true), ChatKeep.room(saved, 950, 200, 900))
    assertEquals(ChatKeep.Room(emptyList(), true), ChatKeep.room(saved, 2_000, 200, 900))
    // Even with all gone it does not fit: skip the save.
    val none = ChatKeep.room(saved, 100, 200, 900)
    assertFalse(none.fits)
    assertEquals(5, none.drop.size)
    assertTrue(ChatKeep.room(emptyList(), 1_100, 200, 900).fits)
  }

  @Test fun aShapeNamesWhatAStateLoadsInto() {
    val shape = ChatShape.of("m", "M-Q4_K_M.gguf", 9, 32_768, true, 4, 77)
    assertEquals("v1\nmodel=m\nfile=M-Q4_K_M.gguf:9\ncontext=32768\nkv=q8_0\ncheckpoints=4\nserver=77\n", shape)
    assertTrue(shape != ChatShape.of("m", "M-Q4_K_M.gguf", 9, 32_768, false, 4, 77))
    assertTrue(ChatShape.of("m", "f", 9, 1, false, null, 1).contains("checkpoints=none"))
  }
}
