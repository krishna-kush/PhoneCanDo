package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.lme.host.chats.StoredChats
import com.phonecando.lme.host.context.ContextPlan
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.context.ContextSizing
import com.phonecando.lme.host.ram.PromptState
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamRules
import com.phonecando.lme.host.ram.ServerMemory

/**
 * llama-server's plan for one model on a phone ([LlamaCppRuntime.contextPlan]):
 * the KV cache's size, the context, the prompt cache and the saved chats it
 * holds, from the phone's RAM, what the server holds besides the prompt
 * ([ServerMemory]: its weights and compute buffer) and the user's
 * [ServeChoices]. With room on storage for chats ([StoredChats]) they are
 * kept there and the server gets no prompt cache; else the prompt cache
 * keeps them in RAM. Half-size (8-bit) notes on Auto when the model's heads
 * allow them and either full size cannot reach 32k (or the whole trained
 * context, when less) within the budget, or full size leaves no room for
 * one saved chat in RAM ([RamRules.SAVED_CHAT_DIVISOR]) where half size
 * would. Pure.
 */
internal object ServePlanner {
    fun plan(
        device: DeviceInfo,
        sizeBytes: Long,
        kvCache: KvCacheShape,
        trained: Long?,
        chosen: Long?,
        serve: ServeChoices,
        memory: ServerMemory,
        storageFreeBytes: Long?,
    ): ContextPlan {
        val total = device.totalRamBytes
        val budget = RamGate.budget(total, serve.ramShare)
        val spare = RamGate.spare(total, device.availableRamBytes, serve.ramShare)
        val checkpoints = LlamaCppRuntime.contextCheckpoints(kvCache, serve)
        fun model(prompts: Int) = Model(memory, kvCache, ContextRange.of(trained), chosen, checkpoints ?: 0, prompts, budget)
        // Chats on storage when one fits there at the context planned without a prompt cache; else in RAM.
        val onStorage = model(0).takeIf { storageFreeBytes != null }
        val stored = onStorage?.let { m -> m.sized(spare, serve.kvCache).let { StoredChats.kept(storageFreeBytes, it.promptBytes) } } ?: 0
        val model = if (stored > 0) onStorage!! else model(LlamaCppRuntime.savedPrompts(serve))
        val now = model.sized(spare, serve.kvCache)
        // With its whole share free, would it get more? Then free memory, not the share, is the limit.
        val whole = if (spare < budget) model.sized(budget, serve.kvCache) else now
        return ContextPlan(
            context = now.context,
            automatic = chosen == null,
            range = model.range,
            needBytes = now.needBytes,
            promptBytes = now.promptBytes,
            promptCacheMiB = now.cacheMiB,
            savedPrompts = now.savedChats,
            halfKvCache = now.half,
            checkpoints = checkpoints,
            threads = LlamaCppRuntime.threads(device, serve),
            freeMemoryLimits = whole.context > now.context || whole.savedChats > now.savedChats,
            ram = RamGate.check(total, now.needBytes, chosen = chosen != null, share = serve.ramShare),
            mappedBytes = memory.mappedBytes,
            computeBytes = now.computeBytes,
            measured = memory.measured,
            storedChats = stored,
        )
    }

    /** One prompt's state at [context] ([PromptState]), its KV cache f16 or [half]. */
    fun promptBytes(kvCache: KvCacheShape, context: Long, half: Boolean, checkpoints: Int): Long {
        val type = if (half) KvCacheType.Q8_0 else KvCacheType.F16
        return PromptState.bytes(kvCache, context, type.bytesPerBlock, LlamaCppRuntime.RECURRENT_BYTES_PER_VALUE, checkpoints)
    }

    private class Sized(
        val context: Long,
        val half: Boolean,
        val needBytes: Long,
        val promptBytes: Long,
        val computeBytes: Long,
        val cacheMiB: Long,
        val savedChats: Int,
    )

    /** [prompts]: the prompt states its prompt cache in RAM has room for (0: none, chats are on storage or the user wants none). */
    private class Model(
        val memory: ServerMemory,
        val kvCache: KvCacheShape,
        val range: ContextRange,
        val chosen: Long?,
        val checkpoints: Int,
        val prompts: Int,
        val budget: Long,
    ) {
        fun state(context: Long, half: Boolean) = promptBytes(kvCache, context, half, checkpoints)

        /** One saved chat: a state at part of the context. */
        fun chat(context: Long, half: Boolean) = state(maxOf(1, context / RamRules.SAVED_CHAT_DIVISOR), half)

        /** What the server holds at [context] besides its weights: one prompt's state and the compute buffer. */
        fun working(context: Long, half: Boolean) = state(context, half) + memory.computeBytes(context)

        fun sized(spare: Long, choice: KvCacheChoice): Sized {
            val half = kvCache.quantizable && when (choice) {
                KvCacheChoice.FULL -> false
                KvCacheChoice.HALF -> true
                KvCacheChoice.AUTO -> !fullReachesFloor() || prompts > 0 && !holdsChat(spare, false) && holdsChat(spare, true)
            }
            return sized(spare, half)
        }

        private fun sized(spare: Long, half: Boolean): Sized {
            val weights = memory.weightsBytes
            val context = chosen?.let(range::coerce)
                ?: ContextSizing.automatic(budget, spare, weights, range, { working(it, half) }, { prompts * state(it, half) })
            val state = state(context, half)
            val compute = memory.computeBytes(context)
            val need = weights + state + compute
            val cacheMiB = RamGate.promptCacheMiB(spare, need, state, prompts)
            return Sized(context, half, need, state, compute, cacheMiB, RamGate.savedChats(cacheMiB, chat(context, half), prompts))
        }

        /** What is left of [spare] beside the slot holds one saved chat. */
        private fun holdsChat(spare: Long, half: Boolean): Boolean = sized(spare, half).let { spare - it.needBytes >= chat(it.context, half) }

        /** With f16, the budget holds the model at 32k (or its whole trained context, when less). */
        private fun fullReachesFloor(): Boolean {
            val floor = minOf(range.max, ContextSizing.AUTO_LEAST)
            return memory.weightsBytes + working(floor, false) <= budget
        }
    }
}
