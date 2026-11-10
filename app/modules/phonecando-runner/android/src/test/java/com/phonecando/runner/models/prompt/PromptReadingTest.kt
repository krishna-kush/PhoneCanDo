package com.phonecando.runner.models.prompt

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// GET /slots of the pinned llama-server (v0.9.0: server-context.cpp
// server_slot::to_json, without LLAMA_SERVER_SLOTS_DEBUG): which slot reads
// a prompt, and how far.
class PromptReadingTest {
  private fun slot(processing: Boolean, processed: Long, cache: Long, decoded: Long) =
    """{"id":0,"n_ctx":16384,"speculative":false,"is_processing":$processing,"id_task":12,""" +
      """"n_prompt_tokens":${cache + processed + 2048},"n_prompt_tokens_processed":$processed,""" +
      """"n_prompt_tokens_cache":$cache,"params":{"seed":4294967295,"temperature":0.8,"stream":true},""" +
      """"next_token":[{"has_next_token":true,"has_new_line":false,"n_remain":-1,"n_decoded":$decoded}]}"""

  @Test fun aSlotThatHasDecodedNothingYetIsReading() {
    assertEquals(PromptReading.Slot(4096, 0), PromptReading.readingSlot("[${slot(true, 4096, 0, 0)}]"))
    assertEquals(PromptReading.Slot(0, 7168), PromptReading.readingSlot("[${slot(true, 0, 7168, 0)}]"))
  }

  @Test fun aSlotWritingItsReplyOrIdleIsNot() {
    assertNull(PromptReading.readingSlot("[${slot(true, 7300, 0, 37)}]"))
    assertNull(PromptReading.readingSlot("[${slot(false, 0, 0, 0)}]"))
  }

  @Test fun aFreshServerHasNoTaskFields() {
    assertNull(PromptReading.readingSlot("""[{"id":0,"n_ctx":16384,"speculative":false,"is_processing":false}]"""))
  }

  @Test fun theReadingSlotIsFoundAmongOthers() {
    val body = "[${slot(false, 0, 0, 0)},${slot(true, 2048, 512, 0)}]"
    assertEquals(PromptReading.Slot(2048, 512), PromptReading.readingSlot(body))
  }

  @Test fun anErrorOrGarbageIsNoReading() {
    assertNull(PromptReading.readingSlot("""{"error":{"code":501,"message":"This server does not support slots endpoint."}}"""))
    assertNull(PromptReading.readingSlot("not json"))
    assertNull(PromptReading.readingSlot("[]"))
  }
}
