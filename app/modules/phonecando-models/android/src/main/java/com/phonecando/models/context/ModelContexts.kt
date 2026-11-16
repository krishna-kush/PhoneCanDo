package com.phonecando.models.context

import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
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
 * A model's context as its card shows it, over lme-host's context plan
 * (LlamaCppRuntime.contextPlan, with the model's own serving choices).
 * Choosing one is the Memory setting's (memory/ModelMemory.kt). Pure.
 */
object ModelContexts {
  /**
   * [record] on [info] now; [serving] its running server, if any (another
   * model's is ignored); [measured] what its server measured of itself
   * here (null: the estimate); [storageFreeBytes] free where its chats would
   * be kept (null: they stay in RAM).
   */
  fun view(
    info: DeviceInfo,
    record: ModelRecord,
    serving: ServingModel?,
    measured: MeasuredMemory? = null,
    storageFreeBytes: Long? = null,
  ): ContextView {
    fun plan(r: ModelRecord) = LlamaCppRuntime.contextPlan(info, r, measured, storageFreeBytes)
    val auto = plan(record.copy(context = null))
    val running = serving?.takeIf { it.modelId == record.id }?.contextSize
    val (served, ram) = when {
      // What it takes served with that context, its KV cache and checkpoints as its choices plan them.
      running != null -> running to RamChecks.of(info, plan(record.copy(context = running)).needBytes, chosen = record.context != null, share = record.serve.ramShare)
      record.context != null -> plan(record).let { it.context to RamChecks.of(info, it) }
      else -> auto.context to RamChecks.of(info, auto)
    }
    return ContextView(served, auto.context, record.context, auto.range, running != null, ram)
  }
}
