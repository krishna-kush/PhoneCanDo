package com.phonecando.models.ram

import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class RamChecksTest {
  private val gib = 1L shl 30

  // Our 8 GB test phone (Moto g96): 7.2 GiB reported, 4 + 4 cores, little else running.
  private val moto = DeviceInfo(
    totalRamBytes = 7_562_532L * 1024,
    availableRamBytes = 5L * gib,
    abi = "arm64-v8a",
    cores = List(8) { CpuCore(1024, null) },
    cpuFeatures = setOf("fp", "asimd", "asimdhp", "asimddp"),
  )

  @Test
  fun `a supported phone`() {
    assertEquals(DeviceCheck(true, null), RamChecks.device(moto))
  }

  @Test
  fun `small phones and old CPUs are not offered local models`() {
    val small = RamChecks.device(moto.copy(totalRamBytes = 4 * gib))
    assertFalse(small.supported)
    assertEquals("local models need a phone with 6 GB of RAM or more", small.reason)
    val old = RamChecks.device(moto.copy(cpuFeatures = setOf("fp", "asimd")))
    assertEquals("the CPU lacks asimddp, asimdhp", old.reason)
    assertFalse(RamChecks.device(moto.copy(totalRamBytes = 0)).supported)
    assertEquals(RamCheck.Verdict.UNSUPPORTED, RamChecks.of(moto.copy(totalRamBytes = 4 * gib), 1).verdict)
  }

  @Test
  fun `verdicts by need`() {
    val budget = moto.totalRamBytes / 100 * 50
    assertEquals(RamCheck(RamCheck.Verdict.FITS, 2 * gib, budget), RamChecks.of(moto, 2 * gib))
    assertEquals(RamCheck.Verdict.TOO_BIG, RamChecks.of(moto, 5 * gib).verdict)
    val sixGb = moto.copy(totalRamBytes = 5_800_000_000)
    assertEquals(RamCheck.Verdict.TIGHT, RamChecks.of(sixGb, gib).verdict)
    // A chosen context: past the budget is a warning, past the phone's RAM a refusal.
    assertEquals(RamCheck(RamCheck.Verdict.OVER_BUDGET, 5 * gib, budget), RamChecks.of(moto, 5 * gib, chosen = true))
    assertEquals(RamCheck.Verdict.TOO_BIG, RamChecks.of(moto, 8 * gib, chosen = true).verdict)
  }

  @Test
  fun `a served model counts its KV cache at the context it would get here`() {
    val qwen = KvCacheShape(16_384, 0, null)
    // Qwen3.5 9B: not even 16k of KV cache fits an 8 GB phone's budget.
    val nine = RamChecks.of(moto, LlamaCppRuntime.contextPlan(moto, 5_680_522_464, qwen, 262_144, null))
    assertEquals(RamCheck(RamCheck.Verdict.TOO_BIG, 6_217_393_376, 3_872_016_350), nine)
    // Qwen3.5 4B: 33k of KV cache (1.03 GiB) is the most that fits, so that is what it needs.
    val four = LlamaCppRuntime.contextPlan(moto, 2_740_937_888, qwen, 262_144, null)
    assertEquals(33_792, four.context)
    assertEquals(RamCheck(RamCheck.Verdict.FITS, 2_740_937_888 + 1_107_296_256, 3_872_016_350), RamChecks.of(moto, four))
    // On an unsupported phone, whatever the plan says.
    assertEquals(RamCheck.Verdict.UNSUPPORTED, RamChecks.of(moto.copy(abi = "x86_64"), four).verdict)
  }

  @Test
  fun `wire names`() {
    assertEquals(
      mapOf("verdict" to "too_big", "needBytes" to 3.0, "budgetBytes" to 2.0),
      RamCheck(RamCheck.Verdict.TOO_BIG, 3, 2).toMap(),
    )
    assertEquals("over_budget", RamCheck.Verdict.OVER_BUDGET.wire)
  }
}
