package com.phonecando.models.memory

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.api.model.RamShare
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.chats.StoredChats
import com.phonecando.models.ram.RamCheck
import com.phonecando.models.serving.ServingModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelMemoryTest {
  private val gib = 1L shl 30

  // Moto g96 (8 GB): 7.2 GiB reported, 4 little and 4 big cores; with plenty free, its budget (3.87 GB) is the bound.
  private val moto = DeviceInfo(
    totalRamBytes = 7_562_532L * 1024,
    availableRamBytes = 5L * gib,
    abi = "arm64-v8a",
    cores = List(4) { CpuCore(439, null) } + List(4) { CpuCore(1024, null) },
    cpuFeatures = setOf("fp", "asimd", "asimdhp", "asimddp"),
  )

  private fun model(id: String, bytes: Long, kv: KvCacheShape) = ModelRecord(
    id = id,
    name = id,
    source = ModelSource.Imported("$id.gguf"),
    files = listOf(ModelFile("$id.gguf", bytes, "0".repeat(64))),
    shape = ModelShape("qwen35", id, "Q4_K_M", null, 262_144, 32, null, kv),
    addedAtMillis = 0,
  )

  // Qwen3.5 0.8B and 4B, hybrid: a recurrent state per sequence, heads in whole 32-value blocks.
  private val small = model("qwen3-5-0-8b", 532_517_120, KvCacheShape(6_144, 0, null, 5_050_368, quantizable = true))
  private val four = model("qwen3-5-4b", 2_740_937_888, KvCacheShape(16_384, 0, null, 13_172_736, quantizable = true))
  private val dense = model("dense", 1_000_000_000, KvCacheShape(16_384, 0, null))

  /** A measurement that counts [m]'s files alone (no copies, no compute): the sizing the tests below pin. */
  private fun files(m: ModelRecord) = MeasuredMemory("test", 1, false, m.sizeBytes, 0, 0, 0)

  @Test
  fun `the choices a model has here, each with what Auto picks`() {
    val traits = ModelMemory.traits(moto, four)
    assertEquals(MemoryTraits.Choice(0..3, 2), traits.savedPrompts)
    assertEquals(MemoryTraits.Choice(2..8, 4), traits.checkpoints)
    assertTrue(traits.halfKvCache)
    assertEquals(MemoryTraits.Choice(1..8, 4), traits.threads)
    assertEquals(listOf(2_555_530_791, 3_872_016_350, 5_111_061_582), RamShare.entries.map { traits.budgets.getValue(it) })
    // A dense model gets no checkpoints, and heads that are not whole blocks no half-size cache.
    val plain = ModelMemory.traits(moto, dense)
    assertNull(plain.checkpoints)
    assertFalse(plain.halfKvCache)
  }

  @Test
  fun `the line follows the choices`() {
    val auto = ModelMemory.view(moto, small, null, ServeChoices.AUTO, null, files(small))
    assertEquals(
      MemoryView(65_536, false, 2, 4, 4, 3_251_818_752, false, RamCheck(RamCheck.Verdict.FITS, 1_438_830_848, 3_872_016_350), measured = true),
      auto,
    )
    // Three saved chats keep the context to 52k.
    val three = ModelMemory.view(moto, small, null, ServeChoices(savedPrompts = 3), null, files(small))
    assertEquals(53_248, three.context)
    assertEquals(3, three.savedPrompts)
    // The 4B: 8-bit to reach 32k, no room left to save a chat.
    val fourAuto = ModelMemory.view(moto, four, null, ServeChoices.AUTO, null, files(four))
    assertEquals(32_768, fourAuto.context)
    assertTrue(fourAuto.halfKvCache)
    assertEquals(0, fourAuto.savedPrompts)
    // With apps open: half-size notes to keep one chat, and free memory, not the share, is the limit.
    val busy = ModelMemory.view(moto.copy(availableRamBytes = 2_904_868_496), small, null, ServeChoices.AUTO, null, files(small))
    assertEquals(listOf(32_768L, 1), listOf(busy.context, busy.savedPrompts.toLong()))
    assertTrue(busy.halfKvCache)
    assertTrue(busy.freeMemoryLimits)
    assertFalse(fourAuto.freeMemoryLimits)
    // Less RAM: it does not run.
    assertEquals(RamCheck.Verdict.TOO_BIG, ModelMemory.view(moto, four, null, ServeChoices(ramShare = RamShare.LESS), null, files(four)).ram.verdict)
    // A chosen context past the budget runs, with a warning.
    assertEquals(RamCheck.Verdict.OVER_BUDGET, ModelMemory.view(moto, four, 131_072, ServeChoices.AUTO, null, files(four)).ram.verdict)
  }

  @Test
  fun `while its server runs, what its plan took from free memory counts as free`() {
    val busy = moto.copy(availableRamBytes = 2 * gib)
    val held = 900L shl 20
    val running = ModelMemory.view(busy, small, null, ServeChoices.AUTO, ServingModel(small.id, 32_768, held), files(small))
    // Exactly as if the phone had that much more free, and no more: the model's mapped files are not added back.
    assertEquals(ModelMemory.view(busy.copy(availableRamBytes = 2 * gib + held), small, null, ServeChoices.AUTO, null, files(small)), running)
    assertTrue(running.totalBytes > ModelMemory.view(busy, small, null, ServeChoices.AUTO, null, files(small)).totalBytes)
    // Another model's server frees nothing of this one's.
    assertEquals(
      ModelMemory.view(busy, small, null, ServeChoices.AUTO, null, files(small)),
      ModelMemory.view(busy, small, null, ServeChoices.AUTO, ServingModel("other", 32_768, held), files(small)),
    )
  }

  @Test
  fun `only what the setting offers may be saved, and never a model that would not run`() {
    ModelMemory.requireAllowed(moto, four, null, ServeChoices.AUTO, files(four))
    ModelMemory.requireAllowed(moto, four, 131_072, ServeChoices(RamShare.MORE, KvCacheChoice.HALF, savedPrompts = 0, checkpoints = 8, threads = 8), files(four))
    fun refused(context: Long?, serve: ServeChoices) =
      assertThrows(IllegalArgumentException::class.java) { ModelMemory.requireAllowed(moto, four, context, serve, files(four)) }
    refused(8_192, ServeChoices.AUTO)
    refused(262_145, ServeChoices.AUTO)
    refused(null, ServeChoices(savedPrompts = 4))
    refused(null, ServeChoices(checkpoints = 1))
    refused(null, ServeChoices(checkpoints = 9))
    refused(null, ServeChoices(threads = 9))
    assertThrows(IllegalArgumentException::class.java) { ModelMemory.requireAllowed(moto, dense, null, ServeChoices(checkpoints = 4), files(dense)) }
    assertThrows(IllegalArgumentException::class.java) { ModelMemory.requireAllowed(moto, dense, null, ServeChoices(kvCache = KvCacheChoice.HALF), files(dense)) }
    assertThrows(LmeException.NotEnoughMemory::class.java) { ModelMemory.requireAllowed(moto, four, null, ServeChoices(ramShare = RamShare.LESS), files(four)) }
    // The 4B's whole 256k fits the phone's RAM 8-bit (over the budget, with a warning); a dense model's does not.
    ModelMemory.requireAllowed(moto, four, 262_144, ServeChoices.AUTO, files(four))
    val e = assertThrows(LmeException.NotEnoughMemory::class.java) { ModelMemory.requireAllowed(moto, dense, 262_144, ServeChoices.AUTO, files(dense)) }
    assertTrue(e.needed > moto.totalRamBytes)
  }

  @Test
  fun `measured, the line counts the server's own numbers, and chats on storage leave the RAM for context`() {
    val mib = 1L shl 20
    val measured = MeasuredMemory("tag", 32_768, true, 202 * mib, 549 * mib, 223 * mib, 67 * mib)
    val view = ModelMemory.view(moto, small, null, ServeChoices.AUTO, null, measured)
    assertTrue(view.measured)
    assertEquals(0, view.storedChats)
    // More than the files alone: the copies and the compute buffer.
    assertTrue(view.ram.needBytes > ModelMemory.view(moto, small, null, ServeChoices.AUTO, null, files(small)).ram.needBytes)
    // Before any measurement: the estimate, more again.
    val estimate = ModelMemory.view(moto, small, null, ServeChoices.AUTO, null)
    assertFalse(estimate.measured)
    assertTrue(estimate.ram.needBytes > view.ram.needBytes)
    // Room on storage: chats go there, none in RAM.
    val stored = ModelMemory.view(moto, small, null, ServeChoices.AUTO, null, measured, 64L shl 30)
    assertEquals(StoredChats.MOST, stored.storedChats)
    assertEquals(0, stored.savedPrompts)
    assertTrue(stored.context >= view.context)
    assertTrue(stored.totalBytes < view.totalBytes)
    // A choice past what the estimate allows may be saved once measured.
    assertThrows(LmeException.NotEnoughMemory::class.java) { ModelMemory.requireAllowed(moto, four, null, ServeChoices.AUTO) }
    ModelMemory.requireAllowed(moto, four, null, ServeChoices.AUTO, files(four))
  }
}
