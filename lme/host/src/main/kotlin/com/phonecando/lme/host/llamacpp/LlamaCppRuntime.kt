package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.api.serve.WireApi
import com.phonecando.lme.host.LaunchPlan
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.ModelRuntime
import com.phonecando.lme.host.ServerCommand
import com.phonecando.lme.host.context.ContextPlan
import com.phonecando.lme.host.context.ContextRange
import com.phonecando.lme.host.context.ContextSizing
import com.phonecando.lme.host.cpu.Threads
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.ram.PromptState
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamRules
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.lme.host.ram.ServerMemory

/**
 * llama.cpp's `llama-server`, our build of the version pinned in
 * `lme/llamacpp/pins.env`, shipped as `libllama-server.so`. Pure: it plans,
 * the host's supervisor runs the plan.
 *
 * The flags are the ones our device spike ran with (Moto g96, 2026-11-08):
 * one slot (`-np 1`) so every request reuses the one prompt cache (on by
 * default; a 10k-token agent prompt went from 126 s cold to 4.9 s cached),
 * the chat template from the model (`--jinja`), thinking off (`--reasoning
 * off`: on a phone CPU it costs minutes per turn), no web UI. With
 * `--slot-prompt-similarity 0` every request saves the slot's prompt to the
 * prompt cache and loads the best one saved there (a copy, under a second),
 * so an agent and its sub-agent taking turns on the one slot each get their
 * own prompt back; the server's default, 0.1, keeps the slot as it is
 * whenever a tenth of the new prompt matches, and a shared tool list does.
 * A model with recurrent or sliding-window layers keeps
 * [RamRules.CONTEXT_CHECKPOINTS] context checkpoints (`--ctx-checkpoints`;
 * the pinned server's default is 32, each a copy of the recurrent state and
 * the window's KV cache). On a phone the prompts it keeps in RAM besides
 * the slot's (`--cache-ram`, in MiB; the pinned server's default is 8192, 0
 * turns it off) get room for [RamRules.CACHED_PROMPTS] whole prompt states
 * ([PromptState]) out of what the RAM gate leaves, so the plan counts all
 * it may hold. A model that cannot reach 32k with an f16 KV cache within
 * its budget, or would have no room left for one saved chat, gets an 8-bit
 * one ([KvCacheType.Q8_0]) when its heads allow ([ServePlanner]).
 * What the server holds besides the prompt, its weights (file pages and
 * the copies its CPU kernels need) and its compute buffer, is the server's
 * own count on this phone once measured ([FitBreakdown], a dry run before
 * the start), else an estimate ([ServerMemory]). With room on storage
 * ([com.phonecando.lme.host.chats.StoredChats]) the host keeps chats there
 * (`--slot-save-path`, its go-between saving and loading the one slot) and
 * the prompt cache gets nothing (`--cache-ram 0`); with one slot and no
 * prompt cache `--slot-prompt-similarity 0` then changes nothing, and we
 * keep it so a server without storage works as before.
 * The user may change each of these per model ([ServeChoices]). The key
 * goes through the environment (`LLAMA_API_KEY`), never the command line,
 * where any app could read it from `/proc`.
 */
object LlamaCppRuntime : ModelRuntime {
    override val id = "llamacpp"

    /** `/v1/chat/completions`, `/v1/responses` and `/v1/messages`, all in the pinned server. */
    override val apis = setOf(WireApi.OPENAI_CHAT, WireApi.OPENAI_RESPONSES, WireApi.ANTHROPIC)

    /** The recurrent state is f32 (llama.cpp's recurrent memory, whatever the KV cache type). */
    const val RECURRENT_BYTES_PER_VALUE = 4L

    /**
     * What the build needs from the CPU (`lme/llamacpp/build.sh`:
     * `-march=armv8.2-a+dotprod+fp16`), by their `/proc/cpuinfo` names.
     */
    val REQUIRED_CPU_FEATURES = setOf("asimddp", "asimdhp")

    const val ABI = "arm64-v8a"
    const val HOST = "127.0.0.1"
    const val KEY_ENV = "LLAMA_API_KEY"

    /**
     * The detailed log ([ServeChoices.detailedLog]): the server's trace
     * level (each request's cache decisions, the checkpoints it makes and
     * restores) and its slots' debug lines (the tokens around the point
     * where a prompt first differs from the one the slot holds).
     */
    val DETAILED_LOG_ENV = mapOf("LLAMA_ARG_LOG_VERBOSITY" to "4", "LLAMA_SERVER_SLOTS_DEBUG" to "1")

    override fun plan(request: LaunchRequest): LaunchPlan {
        val (sizing, server) = command(request)
        when (val ram = sizing.ram) {
            RamVerdict.Hidden -> throw LmeException.UnsupportedDevice("local models need a phone with 6 GB of RAM or more")
            is RamVerdict.Refused -> throw LmeException.NotEnoughMemory(ram.needBytes, ram.budgetBytes)
            is RamVerdict.OverBudget, is RamVerdict.Tight, is RamVerdict.Fits -> Unit
        }
        return LaunchPlan(
            argv = server.argv,
            env = server.env,
            healthUrl = server.healthUrl,
            endpoint = server.endpoint,
            contextSize = server.contextSize,
            promptCacheMiB = sizing.promptCacheMiB,
            totalBytes = sizing.totalBytes,
            heldBytes = sizing.heldBytes,
            threads = sizing.threads,
            ram = sizing.ram,
            halfKvCache = sizing.halfKvCache,
            measured = sizing.measured,
            storedChats = sizing.storedChats,
            promptBytes = sizing.promptBytes,
            checkpoints = sizing.checkpoints,
        )
    }

    /**
     * The dry run that measures [request]'s server before it starts
     * ([FitBreakdown]): the command [plan] would run with what is known now
     * ([LaunchRequest.measured], else the estimate), whatever the RAM gate
     * says, so a model is measured before it is judged; and the context and
     * KV cache it measures at.
     */
    fun measure(request: LaunchRequest): Measure {
        val (sizing, server) = command(request)
        return Measure(FitBreakdown.dryRun(server.argv), server.env, sizing.context, sizing.halfKvCache)
    }

    /** A dry run's [argv] (the executable first) with [env] added to the host's, at [context] tokens. */
    data class Measure(val argv: List<String>, val env: Map<String, String>, val context: Long, val halfKvCache: Boolean) {
        override fun toString(): String = "Measure(argv=$argv, env=${env.keys}, context=$context, halfKvCache=$halfKvCache)"
    }

    // The context plan for [request] and the server it runs, before the RAM gate.
    private fun command(request: LaunchRequest): Pair<ContextPlan, ServerCommand> {
        require(request.port in 1..65535) { "port out of range" }
        require(ApiKeys.isValid(request.apiKey)) { "not a key from ApiKeys" }
        require(request.modelPath.startsWith("/") && request.executable.startsWith("/")) { "paths are absolute" }
        checkDevice(request.device)
        val model = request.model
        val sizing = contextPlan(request.device, model, request.measured, request.chats?.freeBytes)
        val tuning = ServerTuning(
            promptCacheMiB = sizing.promptCacheMiB,
            checkpoints = sizing.checkpoints,
            kvCacheType = if (sizing.halfKvCache) KvCacheType.Q8_0 else KvCacheType.F16,
            detailedLog = model.serve.detailedLog,
            slotSavePath = request.chats?.dir?.takeIf { sizing.storedChats > 0 },
        )
        return sizing to serve(request.executable, request.modelPath, model.id, sizing.context, tuning, request.port, sizing.threads, request.apiKey)
    }

    /**
     * The server for model [modelId] at [modelPath] with a [context]-token
     * context, without [plan]'s device and RAM checks: what [plan] runs once
     * they pass (with [contextPlan]), and what lme-cli runs on a CI host,
     * where they do not apply (with [baseContext]). [tuning] carries the
     * phone's prompt cache, checkpoints, KV cache type, log and chats dir;
     * its defaults leave the server's own, for a host with no phone budget.
     */
    fun serve(
        executable: String,
        modelPath: String,
        modelId: String,
        context: Long,
        tuning: ServerTuning,
        port: Int,
        threads: Int,
        apiKey: String,
    ): ServerCommand {
        require(port in 1..65535) { "port out of range" }
        require(threads >= 1) { "at least one thread" }
        require(context >= 1) { "a context of at least one token" }
        require(ApiKeys.isValid(apiKey)) { "not a key from ApiKeys" }
        require(modelPath.startsWith("/") && executable.startsWith("/")) { "paths are absolute" }
        val base = "http://$HOST:$port"
        val type = tuning.kvCacheType.takeIf { it != KvCacheType.F16 }?.flag
        val argv = listOf(
            executable,
            "--model", modelPath,
            "--alias", modelId,
            "--host", HOST,
            "--port", port.toString(),
            "--ctx-size", context.toString(),
            "--parallel", "1",
            "--slot-prompt-similarity", "0",
            "--threads", threads.toString(),
            "--jinja",
            "--reasoning", "off",
            "--no-ui",
        ) + (type?.let { listOf("--cache-type-k", it, "--cache-type-v", it) } ?: emptyList()) +
            (tuning.checkpoints?.let { listOf("--ctx-checkpoints", it.toString()) } ?: emptyList()) +
            (tuning.promptCacheMiB?.let { listOf("--cache-ram", it.toString()) } ?: emptyList()) +
            (tuning.slotSavePath?.let { listOf("--slot-save-path", it) } ?: emptyList())
        return ServerCommand(
            argv = argv,
            env = mapOf(KEY_ENV to apiKey) + if (tuning.detailedLog) DETAILED_LOG_ENV else emptyMap(),
            healthUrl = "$base/health",
            endpoint = ServedEndpoint(base, modelId, apiKey, context, apis),
            contextSize = context,
        )
    }

    /** The floor ([ContextSizing.FLOOR]), or less for a model trained for [contextLength] tokens: what CI serves. */
    fun baseContext(contextLength: Long?): Long = ContextRange.of(contextLength).min

    /**
     * [contextPlan] for a model on the phone: its own choices, else
     * automatic, with the server's own count on this phone ([measured], else
     * an estimate, [ServerMemory.of]) and [storageFreeBytes] free where its
     * chats would be kept (null: they stay in RAM).
     */
    fun contextPlan(device: DeviceInfo, model: ModelRecord, measured: MeasuredMemory? = null, storageFreeBytes: Long? = null): ContextPlan =
        contextPlan(
            device, model.sizeBytes, model.shape.kvCache, model.shape.contextLength, model.context, model.serve,
            ServerMemory.of(model.sizeBytes, measured), storageFreeBytes,
        )

    /**
     * How a model of [sizeBytes] with [kvCache], trained for [trained]
     * tokens, is served on [device] now, by the user's [serve] choices
     * (their RAM share sets the budget, [RamGate.budget]), its server holding
     * [memory] besides the prompt (weights, compute buffer). [chosen] null:
     * automatic ([ContextSizing.automatic]: the most its weights, compute
     * buffer and one prompt's state fit in what the phone can spare now,
     * [RamGate.spare], with room for the prompt cache's saved prompts, up to
     * 64k; at least 32k when the budget holds it), gated against the budget.
     * Else that context (brought into the model's [ContextRange]), which may
     * pass the budget but not the phone's total RAM. With [storageFreeBytes]
     * holding a saved chat above the margin, chats go to storage and the
     * prompt cache gets nothing; else it gets room for the saved prompts, or
     * what is left of the spare memory. The KV cache is half size where the
     * model needs it ([ServePlanner]). [plan] serves this; a host shows the
     * same.
     */
    fun contextPlan(
        device: DeviceInfo,
        sizeBytes: Long,
        kvCache: KvCacheShape,
        trained: Long?,
        chosen: Long?,
        serve: ServeChoices = ServeChoices.AUTO,
        memory: ServerMemory = ServerMemory.estimated(sizeBytes),
        storageFreeBytes: Long? = null,
    ): ContextPlan = ServePlanner.plan(device, sizeBytes, kvCache, trained, chosen, serve, memory, storageFreeBytes)

    /**
     * The RAM a model takes once served with [context]: what its server
     * holds besides the prompt ([memory]: its weights and compute buffer, by
     * default the estimate for its [sizeBytes] of files) plus one prompt's
     * state (KV cache, f16 or [half]; recurrent state; [checkpoints] context
     * checkpoints: [PromptState]). What [plan] gates on.
     */
    fun memoryNeed(
        sizeBytes: Long,
        kvCache: KvCacheShape,
        context: Long,
        half: Boolean = false,
        checkpoints: Int = contextCheckpoints(kvCache) ?: 0,
        memory: ServerMemory = ServerMemory.estimated(sizeBytes),
    ): Long = memory.weightsBytes + memory.computeBytes(context) + ServePlanner.promptBytes(kvCache, context, half, checkpoints)

    /**
     * `--ctx-checkpoints` for a model with [kvCache]: the user's choice in
     * [RamRules.CHECKPOINTS_RANGE], else [RamRules.CONTEXT_CHECKPOINTS], when
     * it has recurrent or sliding-window layers (the server checkpoints only
     * those; every window its header names counts, on the layers llama.cpp
     * windows, or on all of them when we cannot tell); else null.
     */
    fun contextCheckpoints(kvCache: KvCacheShape, serve: ServeChoices = ServeChoices.AUTO): Int? {
        if (kvCache.recurrentPerSequence <= 0 && kvCache.windowPerToken <= 0) return null
        return serve.checkpoints?.coerceIn(RamRules.CHECKPOINTS_RANGE) ?: RamRules.CONTEXT_CHECKPOINTS
    }

    /** The prompt states the prompt cache has room for: the user's choice in [RamRules.CACHED_PROMPTS_RANGE], else [RamRules.CACHED_PROMPTS]. */
    fun savedPrompts(serve: ServeChoices): Int = serve.savedPrompts?.coerceIn(RamRules.CACHED_PROMPTS_RANGE) ?: RamRules.CACHED_PROMPTS

    /** The CPU threads: the user's choice, at most the phone's cores, else its big cores ([Threads]). */
    fun threads(device: DeviceInfo, serve: ServeChoices = ServeChoices.AUTO): Int =
        serve.threads?.coerceIn(1, maxOf(1, device.cores.size)) ?: Threads.pick(device.cores)

    /** @throws LmeException.UnsupportedDevice when our build cannot run on [device]. */
    fun checkDevice(device: DeviceInfo) {
        if (device.abi != ABI) throw LmeException.UnsupportedDevice("needs a 64-bit ARM phone ($ABI), this one is ${device.abi}")
        val missing = REQUIRED_CPU_FEATURES - device.cpuFeatures
        if (missing.isNotEmpty()) throw LmeException.UnsupportedDevice("the CPU lacks ${missing.sorted().joinToString(", ")}")
    }
}
