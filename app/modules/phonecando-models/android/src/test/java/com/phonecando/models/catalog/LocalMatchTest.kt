package com.phonecando.models.catalog

import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.store.download.PendingDownload
import com.phonecando.lme.store.download.RemoteFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LocalMatchTest {
  private val a = "a".repeat(64)
  private val b = "b".repeat(64)

  private val model = ModelRecord(
    "qwen", "Qwen", ModelSource.HuggingFace("unsloth/Qwen3.5-4B-GGUF", "0".repeat(40)),
    listOf(ModelFile("q.gguf", 1, a)), ModelShape("qwen35", null, null, null, null, 1, null, KvCacheShape.NONE), 0,
  )
  private val pending = PendingDownload("gemma", "gemma", "unsloth/gemma", "1".repeat(40), listOf(RemoteFile("g.gguf", "https://huggingface.co/x", 1, b)), 0)

  @Test
  fun `files are matched by sha256`() {
    val match = LocalMatch(listOf(model), listOf(pending))
    assertEquals("qwen", match.model(a))
    assertNull(match.download(a))
    assertEquals("gemma", match.download(b))
    assertNull(match.model(null))
    assertNull(match.model("c".repeat(64)))
  }
}
