package com.phonecando.models.ram

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.host.context.ContextPlan
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamVerdict

/** Whether this phone can serve local models at all; [reason] says why not, fit for the UI. */
data class DeviceCheck(val supported: Boolean, val reason: String?)

/** One model's RAM verdict on this phone, as JS reads it (RamCheck in app/src/engine/models/types.ts). */
data class RamCheck(val verdict: Verdict, val needBytes: Long, val budgetBytes: Long) {
  enum class Verdict(val wire: String) {
    FITS("fits"),
    TIGHT("tight"),
    OVER_BUDGET("over_budget"),
    TOO_BIG("too_big"),
    UNSUPPORTED("unsupported"),
  }

  fun toMap(): Map<String, Any?> = mapOf(
    "verdict" to verdict.wire,
    "needBytes" to needBytes.toDouble(),
    "budgetBytes" to budgetBytes.toDouble(),
  )
}

/**
 * lme's RAM gate for the screens: the device check, and a verdict per model
 * from what it needs. A model on the phone and a suggestion need their
 * files plus the KV cache at the context its server would get here
 * (LlamaCppRuntime.contextPlan); a Hugging Face variant before its
 * download, its file sizes alone. A context the user chose may pass the
 * budget (over_budget), never the phone's RAM. Pure.
 */
object RamChecks {
  fun device(info: DeviceInfo): DeviceCheck {
    try {
      LlamaCppRuntime.checkDevice(info)
    } catch (e: LmeException.UnsupportedDevice) {
      return DeviceCheck(false, e.reason)
    }
    if (info.totalRamBytes <= 0 || !RamGate.offered(info.totalRamBytes)) {
      return DeviceCheck(false, "local models need a phone with 6 GB of RAM or more")
    }
    return DeviceCheck(true, null)
  }

  /** A model that needs [needBytes]; [chosen]: at a context the user chose. */
  fun of(info: DeviceInfo, needBytes: Long, chosen: Boolean = false): RamCheck {
    if (!device(info).supported) return RamCheck(RamCheck.Verdict.UNSUPPORTED, needBytes, 0)
    return from(RamGate.check(info.totalRamBytes, needBytes, chosen), needBytes)
  }

  /** The verdict a context plan carries. */
  fun of(info: DeviceInfo, plan: ContextPlan): RamCheck {
    if (!device(info).supported) return RamCheck(RamCheck.Verdict.UNSUPPORTED, plan.needBytes, 0)
    return from(plan.ram, plan.needBytes)
  }

  private fun from(verdict: RamVerdict, needBytes: Long): RamCheck = when (verdict) {
    RamVerdict.Hidden -> RamCheck(RamCheck.Verdict.UNSUPPORTED, needBytes, 0)
    is RamVerdict.Refused -> RamCheck(RamCheck.Verdict.TOO_BIG, verdict.needBytes, verdict.budgetBytes)
    is RamVerdict.OverBudget -> RamCheck(RamCheck.Verdict.OVER_BUDGET, verdict.needBytes, verdict.budgetBytes)
    is RamVerdict.Tight -> RamCheck(RamCheck.Verdict.TIGHT, verdict.needBytes, verdict.budgetBytes)
    is RamVerdict.Fits -> RamCheck(RamCheck.Verdict.FITS, verdict.needBytes, verdict.budgetBytes)
  }
}
