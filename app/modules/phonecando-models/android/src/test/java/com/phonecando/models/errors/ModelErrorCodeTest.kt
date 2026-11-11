package com.phonecando.models.errors

import com.phonecando.lme.api.LmeException
import com.phonecando.network.NetException
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.IOException

class ModelErrorCodeTest {
  @Test
  fun `lme failures keep their meaning`() {
    assertEquals(ModelErrorCode.ACCESS_DENIED, ModelErrorCode.of(LmeException.AccessDenied("repository x/y")))
    assertEquals(ModelErrorCode.NETWORK, ModelErrorCode.of(LmeException.Network("https://huggingface.co/x", 500)))
    assertEquals(ModelErrorCode.INVALID_GGUF, ModelErrorCode.of(LmeException.InvalidGguf("no GGUF magic")))
    assertEquals(ModelErrorCode.EXISTS, ModelErrorCode.of(LmeException.Exists("qwen")))
    // A Hub answer we cannot read is not our own list of models.
    assertEquals(ModelErrorCode.BAD_ANSWER, ModelErrorCode.of(LmeException.BadAnswer("repository x/y")))
    assertEquals(ModelErrorCode.CORRUPT, ModelErrorCode.of(LmeException.Corrupt("models.json")))
    assertEquals(ModelErrorCode.CANCELLED, ModelErrorCode.of(NetException.Cancelled()))
    assertEquals(ModelErrorCode.RATE_LIMITED, ModelErrorCode.of(NetException.RateLimited("https://cdn/x")))
    assertEquals(ModelErrorCode.CANCELLED, ModelErrorCode.of(LmeException.Cancelled()))
    assertEquals(ModelErrorCode.NOT_ENOUGH_MEMORY, ModelErrorCode.of(LmeException.NotEnoughMemory(2, 1)))
  }

  @Test
  fun `ours, disks and the rest`() {
    assertEquals(ModelErrorCode.BUSY, ModelErrorCode.of(ModelError(ModelErrorCode.BUSY, "x")))
    assertEquals(ModelErrorCode.NO_SPACE, ModelErrorCode.of(IOException("write failed: ENOSPC (No space left on device)")))
    assertEquals(ModelErrorCode.INTERNAL, ModelErrorCode.of(IOException("EIO")))
    assertEquals(ModelErrorCode.CANCELLED, ModelErrorCode.of(InterruptedException()))
    assertEquals(ModelErrorCode.INTERNAL, ModelErrorCode.of(IllegalStateException("bug")))
  }

  @Test
  fun `codes are unique snake case`() {
    val codes = ModelErrorCode.entries.map { it.code }
    assertEquals(codes.size, codes.toSet().size)
    codes.forEach { assert(Regex("[a-z]+(_[a-z]+)*").matches(it)) { it } }
  }

  @Test
  fun `a message without text names the failure`() {
    assertEquals("cancelled", ModelErrorCode.messageOf(LmeException.Cancelled()))
    assertEquals("IllegalStateException", ModelErrorCode.messageOf(IllegalStateException()))
  }
}
