package com.phonecando.models.context

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.models.ram.RamCheck
import com.phonecando.models.serving.ServingModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelContextsTest {
  private val gib = 1L shl 30

  // Moto g96 (8 GB): 7.2 GiB reported; with plenty free, its budget (3.87 GB) is the bound.
  private val moto = DeviceInfo(
    totalRamBytes = 7_562_532L * 1024,
    availableRamBytes = 5L * gib,
    abi = "arm64-v8a",
    cores = List(8) { CpuCore(1024, null) },
    cpuFeatures = setOf("fp", "asimd", "asimdhp", "asimddp"),
  )

  private fun model(id: String, bytes: Long, trained: Long?, context: Long? = null) = ModelRecord(
    id = id,
    name = id,
    source = ModelSource.Imported("$id.gguf"),
    files = listOf(ModelFile("$id.gguf", bytes, "0".repeat(64))),
    shape = ModelShape("qwen35", id, "Q4_K_M", null, trained, 32, null, KvCacheShape(16_384, 0, null)),
    addedAtMillis = 0,
    context = context,
  )

  private val four = model("qwen3-5-4b", 2_740_937_888, 262_144)

  @Test
  fun `automatic is what a start would pick now, reduced on this phone`() {
    val view = ModelContexts.view(moto, four, null)
    assertEquals(ContextView(33_792, 33_792, null, ContextRange(16_384, 262_144), false, view.ram), view)
    assertEquals(RamCheck.Verdict.FITS, view.ram.verdict)
    // Less free memory: less context, never below the floor.
    assertEquals(16_384, ModelContexts.view(moto.copy(availableRamBytes = 2 * gib), four, null).served)
  }

  @Test
  fun `a chosen context is served as chosen, and automatic still shows what it would pick`() {
    val view = ModelContexts.view(moto, four.copy(context = 65_536), null)
    assertEquals(65_536, view.served)
    assertEquals(33_792, view.auto)
    assertEquals(65_536L, view.choice)
    assertEquals(RamCheck.Verdict.OVER_BUDGET, view.ram.verdict)
  }

  @Test
  fun `while its server runs, the card shows that server's context`() {
    // The server itself takes memory, so automatic now would pick less than it runs with.
    val busy = moto.copy(availableRamBytes = 2 * gib)
    val view = ModelContexts.view(busy, four, ServingModel(four.id, 33_792))
    assertTrue(view.serving)
    assertEquals(33_792, view.served)
    assertEquals(16_384, view.auto)
    assertEquals(RamCheck(RamCheck.Verdict.FITS, 2_740_937_888 + 1_107_296_256, 3_872_016_350), view.ram)
    // Another model's server says nothing about this one.
    assertFalse(ModelContexts.view(busy, four, ServingModel("other", 262_144)).serving)
  }

  @Test
  fun `the slider's verdict follows the context`() {
    assertEquals(RamCheck.Verdict.FITS, ModelContexts.check(moto, four, 16_384).verdict)
    assertEquals(RamCheck.Verdict.OVER_BUDGET, ModelContexts.check(moto, four, 131_072).verdict)
    assertEquals(RamCheck.Verdict.TOO_BIG, ModelContexts.check(moto, four, 262_144).verdict)
    assertEquals(2_740_937_888 + 536_870_912, ModelContexts.check(moto, four, 16_384).needBytes)
  }

  @Test
  fun `a choice may pass the budget, never the phone's RAM or the model's range`() {
    ModelContexts.requireAllowed(moto, four, null)
    ModelContexts.requireAllowed(moto, four, 16_384)
    ModelContexts.requireAllowed(moto, four, 131_072)
    val e = assertThrows(LmeException.NotEnoughMemory::class.java) { ModelContexts.requireAllowed(moto, four, 262_144) }
    assertEquals(2_740_937_888 + 8_589_934_592, e.needed)
    assertThrows(IllegalArgumentException::class.java) { ModelContexts.requireAllowed(moto, four, 8_192) }
    assertThrows(IllegalArgumentException::class.java) { ModelContexts.requireAllowed(moto, four, 262_145) }
  }

  @Test
  fun `a model of unknown context has the floor only`() {
    val view = ModelContexts.view(moto, model("odd", 1_000_000_000, null), null)
    assertEquals(ContextRange(16_384, 16_384), view.range)
    assertEquals(16_384, view.served)
    assertNull(view.choice)
  }
}
