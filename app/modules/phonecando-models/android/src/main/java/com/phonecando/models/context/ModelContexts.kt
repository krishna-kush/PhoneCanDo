package com.phonecando.models.context

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.models.ram.RamCheck
import com.phonecando.models.ram.RamChecks
import com.phonecando.models.serving.ServingModel

/**
 * One model's context on this phone, as JS reads it (LocalModel in
 * app/src/engine/models/types.ts).
 *
 * @property served what its server runs with now ([serving]), else what a
 *   start would get now: the chosen context, or automatic
 * @property auto what automatic picks now, from the memory free now
 * @property choice the user's choice; null: automatic
 * @property ram the verdict at [served]
 */
data class ContextView(
  val served: Long,
  val auto: Long,
  val choice: Long?,
  val range: ContextRange,
  val serving: Boolean,
  val ram: RamCheck,
)

/**
 * The Context setting's reads and checks over lme-host's context plan
 * (LlamaCppRuntime.contextPlan): the view on a model's card, the verdict
 * for a context on the slider, and whether a choice may be saved. Pure.
 */
object ModelContexts {
  /** [record] on [info] now; [serving] its running server, if any (another model's is ignored). */
  fun view(info: DeviceInfo, record: ModelRecord, serving: ServingModel?): ContextView {
    val auto = LlamaCppRuntime.contextPlan(info, record.copy(context = null))
    val running = serving?.takeIf { it.modelId == record.id }?.contextSize
    val (served, ram) = when {
      running != null -> running to RamChecks.of(info, need(record, running), chosen = record.context != null)
      record.context != null -> LlamaCppRuntime.contextPlan(info, record).let { it.context to RamChecks.of(info, it) }
      else -> auto.context to RamChecks.of(info, auto)
    }
    return ContextView(served, auto.context, record.context, auto.range, running != null, ram)
  }

  /** The verdict for [record] served with [context] tokens as the user would choose it: the slider's line. */
  fun check(info: DeviceInfo, record: ModelRecord, context: Long): RamCheck =
    RamChecks.of(info, LlamaCppRuntime.contextPlan(info, record.copy(context = context)))

  /**
   * Whether [context] may be saved for [record] (null, automatic, always
   * may): within its range and, though it may pass the budget, not past the
   * phone's RAM.
   *
   * @throws IllegalArgumentException outside the model's range
   * @throws LmeException.NotEnoughMemory past the phone's RAM
   */
  fun requireAllowed(info: DeviceInfo, record: ModelRecord, context: Long?) {
    if (context == null) return
    val range = ContextRange.of(record.shape.contextLength)
    require(context in range) { "a context from ${range.min} to ${range.max} tokens" }
    val plan = LlamaCppRuntime.contextPlan(info, record.copy(context = context))
    if (plan.ram is RamVerdict.Refused) throw LmeException.NotEnoughMemory(plan.needBytes, RamGate.budget(info.totalRamBytes))
  }

  private fun need(record: ModelRecord, context: Long): Long =
    LlamaCppRuntime.memoryNeed(record.sizeBytes, record.shape.kvCache, context)
}
