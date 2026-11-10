package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelRecord
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
import com.phonecando.lme.host.ram.KvBytes
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamVerdict

/**
 * llama.cpp's `llama-server`, our build of the version pinned in
 * `lme/llamacpp/pins.env`, shipped as `libllama-server.so`. Pure: it plans,
 * the host's supervisor runs the plan.
 *
 * The flags are the ones our device spike ran with (Moto g96, 2026-11-08):
 * one slot (`-np 1`) so every request reuses the one prompt cache (on by
 * default; a 10k-token agent prompt went from 126 s cold to 4.9 s cached),
 * the chat template from the model (`--jinja`), thinking off (`--reasoning
 * off`: on a phone CPU it costs minutes per turn), no web UI. On a phone the
 * prompts it keeps in RAM besides the slot's (`--cache-ram`, in MiB; the
 * pinned server's default is 8192, 0 turns it off) are capped by what the
 * RAM gate leaves after the files and the KV cache. The key goes through
 * the environment (`LLAMA_API_KEY`), never the command line, where any app
 * could read it from `/proc`.
 */
object LlamaCppRuntime : ModelRuntime {
    override val id = "llamacpp"

    /** `/v1/chat/completions`, `/v1/responses` and `/v1/messages`, all in the pinned server. */
    override val apis = setOf(WireApi.OPENAI_CHAT, WireApi.OPENAI_RESPONSES, WireApi.ANTHROPIC)

    /** The KV cache is f16 (the server's default `--cache-type-k/v`). */
    const val KV_BYTES_PER_VALUE = 2L

    /**
     * What the build needs from the CPU (`lme/llamacpp/build.sh`:
     * `-march=armv8.2-a+dotprod+fp16`), by their `/proc/cpuinfo` names.
     */
    val REQUIRED_CPU_FEATURES = setOf("asimddp", "asimdhp")

    const val ABI = "arm64-v8a"
    const val HOST = "127.0.0.1"
    const val KEY_ENV = "LLAMA_API_KEY"

    override fun plan(request: LaunchRequest): LaunchPlan {
        require(request.port in 1..65535) { "port out of range" }
        require(ApiKeys.isValid(request.apiKey)) { "not a key from ApiKeys" }
        require(request.modelPath.startsWith("/") && request.executable.startsWith("/")) { "paths are absolute" }
        checkDevice(request.device)

        val model = request.model
        val sizing = contextPlan(request.device, model)
        when (val ram = sizing.ram) {
            RamVerdict.Hidden -> throw LmeException.UnsupportedDevice("local models need a phone with 6 GB of RAM or more")
            is RamVerdict.Refused -> throw LmeException.NotEnoughMemory(ram.needBytes, ram.budgetBytes)
            is RamVerdict.OverBudget, is RamVerdict.Tight, is RamVerdict.Fits -> Unit
        }
        val threads = Threads.pick(request.device.cores)
        val server = serve(request.executable, request.modelPath, model.id, sizing.context, sizing.promptCacheMiB, request.port, threads, request.apiKey)
        return LaunchPlan(
            argv = server.argv,
            env = server.env,
            healthUrl = server.healthUrl,
            endpoint = server.endpoint,
            contextSize = server.contextSize,
            promptCacheMiB = sizing.promptCacheMiB,
            threads = threads,
            ram = sizing.ram,
        )
    }

    /**
     * The server for model [modelId] at [modelPath] with a [context]-token
     * context, without [plan]'s device and RAM checks: what [plan] runs once
     * they pass (with [contextPlan]), and what lme-cli runs on a CI host,
     * where they do not apply (with [baseContext]). [promptCacheMiB] caps
     * the prompt cache (`--cache-ram`); null leaves the server's default,
     * for a host with no phone budget.
     */
    fun serve(
        executable: String,
        modelPath: String,
        modelId: String,
        context: Long,
        promptCacheMiB: Long?,
        port: Int,
        threads: Int,
        apiKey: String,
    ): ServerCommand {
        require(port in 1..65535) { "port out of range" }
        require(threads >= 1) { "at least one thread" }
        require(context >= 1) { "a context of at least one token" }
        require(promptCacheMiB == null || promptCacheMiB >= 0) { "a prompt cache of zero MiB or more" }
        require(ApiKeys.isValid(apiKey)) { "not a key from ApiKeys" }
        require(modelPath.startsWith("/") && executable.startsWith("/")) { "paths are absolute" }
        val base = "http://$HOST:$port"
        val argv = listOf(
            executable,
            "--model", modelPath,
            "--alias", modelId,
            "--host", HOST,
            "--port", port.toString(),
            "--ctx-size", context.toString(),
            "--parallel", "1",
            "--threads", threads.toString(),
            "--jinja",
            "--reasoning", "off",
            "--no-ui",
        ) + (promptCacheMiB?.let { listOf("--cache-ram", it.toString()) } ?: emptyList())
        return ServerCommand(
            argv = argv,
            env = mapOf(KEY_ENV to apiKey),
            healthUrl = "$base/health",
            endpoint = ServedEndpoint(base, modelId, apiKey, context, apis),
            contextSize = context,
        )
    }

    /** The floor ([ContextSizing.FLOOR]), or less for a model trained for [contextLength] tokens: what CI serves. */
    fun baseContext(contextLength: Long?): Long = ContextRange.of(contextLength).min

    /** [contextPlan] for a model on the phone: its own choice, else automatic. */
    fun contextPlan(device: DeviceInfo, model: ModelRecord): ContextPlan =
        contextPlan(device, model.sizeBytes, model.shape.kvCache, model.shape.contextLength, model.context)

    /**
     * How a model of [sizeBytes] with [kvCache], trained for [trained]
     * tokens, is served on [device] now. [chosen] null: automatic, the
     * largest context its files plus KV cache fit in what the phone can
     * spare now ([RamGate.spare]), from the floor up to [trained]
     * ([ContextSizing]), gated against the budget. Else that context
     * (brought into the model's [ContextRange]), which may pass the budget
     * but not the phone's total RAM. The prompt cache gets what is left of
     * the spare memory. [plan] serves this; a host shows the same.
     */
    fun contextPlan(device: DeviceInfo, sizeBytes: Long, kvCache: KvCacheShape, trained: Long?, chosen: Long?): ContextPlan {
        val total = device.totalRamBytes
        val spare = RamGate.spare(total, device.availableRamBytes)
        val range = ContextRange.of(trained)
        val context = chosen?.let(range::coerce) ?: ContextSizing.automatic(spare, sizeBytes, range) { kvBytes(kvCache, it) }
        val need = memoryNeed(sizeBytes, kvCache, context)
        return ContextPlan(
            context = context,
            automatic = chosen == null,
            range = range,
            needBytes = need,
            promptCacheMiB = RamGate.promptCacheMiB(spare, need),
            ram = RamGate.check(total, need, chosen = chosen != null),
        )
    }

    /** The RAM a model takes once served with [context]: its files plus its KV cache. What [plan] gates on. */
    fun memoryNeed(sizeBytes: Long, kvCache: KvCacheShape, context: Long): Long = sizeBytes + kvBytes(kvCache, context)

    private fun kvBytes(kvCache: KvCacheShape, context: Long): Long = KvBytes.of(kvCache, context, KV_BYTES_PER_VALUE)

    /** @throws LmeException.UnsupportedDevice when our build cannot run on [device]. */
    fun checkDevice(device: DeviceInfo) {
        if (device.abi != ABI) throw LmeException.UnsupportedDevice("needs a 64-bit ARM phone ($ABI), this one is ${device.abi}")
        val missing = REQUIRED_CPU_FEATURES - device.cpuFeatures
        if (missing.isNotEmpty()) throw LmeException.UnsupportedDevice("the CPU lacks ${missing.sorted().joinToString(", ")}")
    }
}
