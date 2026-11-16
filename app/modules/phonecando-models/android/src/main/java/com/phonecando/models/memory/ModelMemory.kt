package com.phonecando.models.memory

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.RamShare
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamRules
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.models.ram.RamCheck
import com.phonecando.models.ram.RamChecks
import com.phonecando.models.serving.ServingModel

/**
 * What a model gets on this phone with some serving choices, from lme's
 * plan: the Memory setting's line (MemoryPlan in app/src/engine/models/types.ts).
 *
 * @property savedPrompts the saved chats its prompt cache holds besides the
 *   one being worked on (each a state at half the context)
 * @property checkpoints its context checkpoints; null when it gets none
 * @property totalBytes what its server holds once the prompt cache fills
 * @property freeMemoryLimits the memory free now, not the RAM share, keeps
 *   it from more context or saved chats
 * @property storedChats the chats kept on storage instead, at most (then
 *   [savedPrompts] is 0); 0 when they stay in RAM
 * @property measured the numbers count what its server measured of itself
 *   on this phone; false: an estimate until its first measurement
 */
data class MemoryView(
  val context: Long,
  val halfKvCache: Boolean,
  val savedPrompts: Int,
  val checkpoints: Int?,
  val threads: Int,
  val totalBytes: Long,
  val freeMemoryLimits: Boolean,
  val ram: RamCheck,
  val storedChats: Int = 0,
  val measured: Boolean = false,
)

/**
 * What the Memory setting may offer for a model on this phone, each with
 * what Auto picks (ModelTraits in types.ts).
 *
 * @property checkpoints null for a model the server makes none for (no
 *   recurrent or sliding-window layers)
 * @property halfKvCache its heads allow an 8-bit KV cache
 * @property threads 1 to the phone's cores
 * @property budgets what each RAM share lets it take here
 */
data class MemoryTraits(
  val savedPrompts: Choice,
  val checkpoints: Choice?,
  val halfKvCache: Boolean,
  val threads: Choice,
  val budgets: Map<RamShare, Long>,
) {
  data class Choice(val range: IntRange, val auto: Int)
}

/**
 * The Memory setting's reads and checks over lme-host's plan
 * (LlamaCppRuntime.contextPlan): what a model may choose here, what a set
 * of choices gives now, and whether they may be saved. Pure.
 */
object ModelMemory {
  fun traits(info: DeviceInfo, record: ModelRecord): MemoryTraits {
    val kv = record.shape.kvCache
    val cores = maxOf(1, info.cores.size)
    return MemoryTraits(
      savedPrompts = MemoryTraits.Choice(RamRules.CACHED_PROMPTS_RANGE, RamRules.CACHED_PROMPTS),
      checkpoints = LlamaCppRuntime.contextCheckpoints(kv)?.let { MemoryTraits.Choice(RamRules.CHECKPOINTS_RANGE, it) },
      halfKvCache = kv.quantizable,
      threads = MemoryTraits.Choice(1..cores, LlamaCppRuntime.threads(info)),
      budgets = RamShare.entries.associateWith { RamGate.budget(info.totalRamBytes, it) },
    )
  }

  /**
   * [record] served with [context] (null: automatic) and [serve] on [info]
   * now, with what its server measured of itself here ([measured]; null:
   * the estimate) and [storageFreeBytes] free where its chats would be kept
   * (null: they stay in RAM). While [serving] runs this model, what its
   * server takes from free memory (as its plan counted it at its start)
   * counts as free: a change restarts it, which frees that first.
   */
  fun view(
    info: DeviceInfo,
    record: ModelRecord,
    context: Long?,
    serve: ServeChoices,
    serving: ServingModel?,
    measured: MeasuredMemory? = null,
    storageFreeBytes: Long? = null,
  ): MemoryView {
    val running = serving?.takeIf { it.modelId == record.id }
    val device = if (running == null) info else info.copy(availableRamBytes = info.availableRamBytes + running.heldBytes)
    val plan = LlamaCppRuntime.contextPlan(device, record.copy(context = context, serve = serve), measured, storageFreeBytes)
    return MemoryView(
      context = plan.context,
      halfKvCache = plan.halfKvCache,
      savedPrompts = plan.savedPrompts,
      checkpoints = plan.checkpoints,
      threads = plan.threads,
      totalBytes = plan.totalBytes,
      freeMemoryLimits = plan.freeMemoryLimits,
      ram = RamChecks.of(device, plan),
      storedChats = plan.storedChats,
      measured = plan.measured,
    )
  }

  /**
   * Whether [context] and [serve] may be saved for [record]: each within
   * what [traits] offers (a context within the model's range; half-size only
   * where its heads allow it; checkpoints only for a model that gets them),
   * and a plan the gate does not refuse (a chosen context may pass the
   * budget, never the phone's RAM), with what its server measured here
   * ([measured]; null: the estimate).
   *
   * @throws IllegalArgumentException for a choice it does not offer
   * @throws LmeException.NotEnoughMemory when the model would not run
   */
  fun requireAllowed(info: DeviceInfo, record: ModelRecord, context: Long?, serve: ServeChoices, measured: MeasuredMemory? = null) {
    val traits = traits(info, record)
    if (context != null) {
      val range = ContextRange.of(record.shape.contextLength)
      require(context in range) { "a context from ${range.min} to ${range.max} tokens" }
    }
    serve.savedPrompts?.let { require(it in traits.savedPrompts.range) { "from ${traits.savedPrompts.range.first} to ${traits.savedPrompts.range.last} saved chats" } }
    serve.checkpoints?.let { n ->
      val range = requireNotNull(traits.checkpoints) { "no checkpoints for this model" }.range
      require(n in range) { "from ${range.first} to ${range.last} checkpoints" }
    }
    serve.threads?.let { require(it in traits.threads.range) { "from 1 to ${traits.threads.range.last} threads" } }
    require(serve.kvCache != KvCacheChoice.HALF || traits.halfKvCache) { "this model's KV cache cannot be half size" }
    val plan = LlamaCppRuntime.contextPlan(info, record.copy(context = context, serve = serve), measured)
    if (plan.ram is RamVerdict.Refused) throw LmeException.NotEnoughMemory(plan.needBytes, RamGate.budget(info.totalRamBytes, serve.ramShare))
  }
}
