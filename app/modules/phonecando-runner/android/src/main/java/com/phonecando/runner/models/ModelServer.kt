package com.phonecando.runner.models

import android.util.Log
import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.http.UrlConnectionPort
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.lme.host.LaunchPlan
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.health.HealthProbe
import com.phonecando.lme.host.health.Readiness
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.runner.engine.EngineEnv
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.PortAllocator
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.engine.spawn.ServerSpawner
import java.io.File
import kotlin.concurrent.thread

// The local model servers (lme's llama-server): one per model, as many
// models at once as the user's cap allows (none by default), outside the
// agents' cap. An agent bound to a model acquires it when its engine
// starts: its server is started on demand from lme-host's launch plan
// (libllama-server.so from the native-library dir, 127.0.0.1 on a port of
// ours, a fresh random key in its env, never its argv), and the start
// waits for /health to answer ready (Readiness: a 4B model took 27 s on our
// test phone). Every agent bound to the same model shares its server
// (ModelSlotPolicy). Each agent's lease ends with its engine (a stop, a
// failed start, a death); the last one of a model stops its server
// (SIGTERM, SIGKILL after the grace). stop(modelId) ends one whoever holds
// it, also while it loads (the supervisor stops its agents first). A
// server that dies by itself takes its agents down with it (onDied): their
// engines have its old URL and key. Each server writes its own log
// ([logFile] of its model id). Its process carries PHONECANDO_AGENT=
// model-server and PHONECANDO_MODEL=<model id>, so a stop-all finds every
// one and the memory guard tells them apart; the first launch of this
// process reaps what an earlier app process left (only then: later a
// tagged server is a sibling of ours). The lock guards the map and the
// leases only: launching and waiting run outside it.
internal class ModelServer(
  private val ports: PortAllocator,
  private val reaper: ProcessReaper,
  /** The APK's native-library dir. */
  private val libDir: String,
  /** A model's server log, by model id. */
  private val logFile: (modelId: String) -> File,
  private val device: () -> DeviceInfo,
  /** A model's entry file in the store. */
  private val modelFile: (ModelRecord) -> File,
  /** The user's cap on loaded models (RunLimits.maxModels); null: none. */
  private val maxModels: () -> Int? = { null },
  /** The server of [holders]' model ended by itself; [detail] says how. */
  private val onDied: (holders: Set<String>, detail: String) -> Unit,
) {
  private val lock = Any()
  private val runs = LinkedHashMap<String, ModelRun>()
  private val sweep = Any()
  private var swept = false

  /**
   * The server of [model] for [agentId]'s engine, started first when it is
   * not up; blocks while it loads. Throws EngineStartException
   * model_unavailable (with why), too_many_models (the user's cap) or
   * start_failed (the agent was stopped meanwhile); the agent holds no
   * lease then.
   */
  fun acquire(agentId: String, model: ModelRecord): ServedEndpoint {
    val previous: ModelRun?
    val orphans: Set<String>
    val mine: ModelRun
    synchronized(lock) {
      val current = runs[model.id]
      val others = current?.leases?.minus(agentId).orEmpty()
      val wanted = current?.let { ModelSlotPolicy.Wanted(it.alive, it.endpoint != null, others.isNotEmpty()) }
      when (val decision = ModelSlotPolicy.decide(wanted, othersUp(current), maxModels())) {
        ModelSlotPolicy.Decision.Reuse -> {
          current!!.leases += agentId
          return checkNotNull(current.endpoint)
        }
        ModelSlotPolicy.Decision.Loading -> throw unavailable(ModelReasons.loading(model.name))
        is ModelSlotPolicy.Decision.Capped -> throw capped(decision.cap)
        ModelSlotPolicy.Decision.Start -> Unit
      }
      previous = current
      // Holders of a server that died before its watch told them: they go down below.
      orphans = others
      current?.leases?.clear()
      mine = ModelRun(model).also { it.leases += agentId }
      runs[model.id] = mine
    }
    previous?.let { ModelRun.end(listOf(it), reaper, ports) }
    if (orphans.isNotEmpty()) onDied(orphans, ModelReasons.exited(previous?.model?.name ?: model.name, null))
    try {
      val endpoint = launch(mine)
      synchronized(lock) {
        if (runs[model.id] !== mine) throw stopped()
        mine.endpoint = endpoint
      }
      watch(mine)
      Log.i(LOG_TAG, "model ${model.id} ready for $agentId")
      return endpoint
    } catch (e: Exception) {
      synchronized(lock) {
        if (runs[model.id] === mine) runs.remove(model.id)
        mine.leases.clear()
      }
      ModelRun.end(listOf(mine), reaper, ports)
      throw asStartFailure(e, model.name)
    }
  }

  /**
   * Refuses at once, before a seat is taken, a model that is not up while
   * the user's cap on loaded models is reached (acquire decides again).
   */
  fun checkCap(modelId: String) {
    val cap = maxModels() ?: return
    synchronized(lock) {
      val current = runs[modelId]
      if (current?.alive == true) return
      if (othersUp(current) >= cap) throw capped(cap)
    }
  }

  /** [agentId]'s engine is gone: its lease on its model ends, and the last holder stops that server. A loading one sees it and gives up. */
  fun release(agentId: String) {
    val ending = synchronized(lock) {
      val run = runs.values.firstOrNull { agentId in it.leases } ?: return
      run.leases.remove(agentId)
      if (run.leases.isNotEmpty()) return
      runs.remove(run.model.id)
      run
    }
    Log.i(LOG_TAG, "no agent uses model ${ending.model.id} any more, stopping it")
    ModelRun.end(listOf(ending), reaper, ports)
  }

  /** Ends [modelId]'s server whoever holds it, also while it loads; the agents it held (stop them first). */
  fun stop(modelId: String): Set<String> {
    val (ending, holders) = synchronized(lock) {
      val run = runs.remove(modelId) ?: return emptySet()
      run to run.leases.toSet().also { run.leases.clear() }
    }
    Log.i(LOG_TAG, "stopping model $modelId")
    ModelRun.end(listOf(ending), reaper, ports)
    return holders
  }

  /** The agents holding [modelId]'s server (also while it loads). */
  fun holders(modelId: String): Set<String> = synchronized(lock) { runs[modelId]?.leases?.toSet().orEmpty() }

  /** The servers that answer now: each one's model, endpoint and the agents holding it. */
  fun serving(): List<Serving> = synchronized(lock) {
    runs.values.mapNotNull { run -> run.endpoint?.let { Serving(run.model, it, run.leases.toSet()) } }
  }

  /** Every server loading or ready, with its holders (the memory guard). */
  fun loaded(): List<Loaded> = synchronized(lock) {
    runs.values.filter { it.alive }.map { Loaded(it.model, it.endpoint != null, it.leases.toSet()) }
  }

  /** A ready server; [endpoint] keeps its key out of toString. */
  data class Serving(val model: ModelRecord, val endpoint: ServedEndpoint, val holders: Set<String>)

  /** A server loading or ready (no endpoint, so no key). */
  data class Loaded(val model: ModelRecord, val ready: Boolean, val holders: Set<String>)

  /** Ends every server whoever holds it, and what an earlier app process left, within one grace (stop all, the updater). */
  fun stopAll() {
    val ending = synchronized(lock) {
      runs.values.toList().also {
        it.forEach { run -> run.leases.clear() }
        runs.clear()
      }
    }
    ModelRun.end(ending, reaper, ports, setOf(TAG))
  }

  // Servers of other models than [current]'s loading or ready.
  private fun othersUp(current: ModelRun?): Int = runs.values.count { it !== current && it.alive }

  // Plans, spawns and waits for ready; the run is its model's while it does.
  private fun launch(mine: ModelRun): ServedEndpoint {
    val id = mine.model.id
    val exe = File(libDir, BINARY)
    if (!exe.isFile) throw unavailable(ModelReasons.noServer())
    sweepLeftovers()
    val port = ports.allocate(null).port
    if (!mine.attachPort(port)) {
      ports.release(port)
      throw stopped()
    }
    val key = ApiKeys.newKey()
    ModelServerKeys.add(key)
    val plan = LlamaCppRuntime.plan(
      LaunchRequest(mine.model, modelFile(mine.model).absolutePath, exe.absolutePath, device(), port, key),
    )
    Log.i(LOG_TAG, "model $id: context ${plan.contextSize}, prompt cache ${plan.promptCacheMiB} MiB, ${plan.ram}")
    if (plan.ram is RamVerdict.OverBudget) Log.w(LOG_TAG, "model $id runs past the RAM budget at its chosen context")
    val log = logFile(id)
    log.parentFile?.mkdirs()
    val proc = ServerSpawner.spawn(plan.argv, env(plan, id), log.parentFile ?: File("/"), log)
    if (!mine.attachProcess(proc)) {
      reaper.stop(listOf(proc), emptySet())
      throw stopped()
    }
    if (synchronized(lock) { runs[id] !== mine }) throw stopped()
    val probe = HealthProbe(UrlConnectionPort(connectTimeoutMillis = PROBE_CONNECT_MS, readTimeoutMillis = PROBE_READ_MS))
    Readiness(probe = { probe.probe(plan.healthUrl) }, alive = { proc.isAlive })
      .await { synchronized(lock) { runs[id] !== mine } }
    return plan.endpoint
  }

  // What an earlier app process left: its ports and RAM are ours to take
  // back. Once per process, before our first server: a launch that comes
  // meanwhile waits here, so no sibling of ours is ever caught.
  private fun sweepLeftovers() {
    synchronized(sweep) {
      if (swept) return
      swept = true
      reaper.stop(emptyList(), setOf(TAG))
    }
  }

  // Our process env, the plan's (its key), and the tags that make it ours to reap and tell apart.
  private fun env(plan: LaunchPlan, modelId: String): Map<String, String> {
    val env = LinkedHashMap(System.getenv())
    env.remove(EngineEnv.BRIDGE_URL)
    env.remove(EngineEnv.BRIDGE_TOKEN)
    env.putAll(plan.env)
    env[EngineEnv.AGENT] = TAG
    env[EngineEnv.MODEL] = modelId
    return env
  }

  // An exit nobody asked for: the model is free, and its holders go down.
  private fun watch(mine: ModelRun) {
    val proc = mine.process ?: return
    thread(name = "phonecando-model-watch", isDaemon = true) {
      val code = try {
        proc.waitFor()
      } catch (_: InterruptedException) {
        return@thread
      }
      val holders = synchronized(lock) {
        if (runs[mine.model.id] !== mine) return@thread
        runs.remove(mine.model.id)
        mine.leases.toSet().also { mine.leases.clear() }
      }
      Log.w(LOG_TAG, "model server for ${mine.model.id} exited with $code")
      ModelRun.end(listOf(mine), reaper, ports)
      if (holders.isNotEmpty()) onDied(holders, ModelReasons.exited(mine.model.name, code))
    }
  }

  private fun asStartFailure(e: Exception, name: String): EngineStartException = when (e) {
    is EngineStartException -> e
    is LmeException.Cancelled -> stopped()
    is LmeException.NotEnoughMemory -> unavailable(ModelReasons.tooBig(name, e.needed, e.budget))
    is LmeException.UnsupportedDevice -> unavailable(ModelReasons.unsupported(e.reason))
    is LmeException.ServerNotReady -> unavailable(ModelReasons.notReady(e.reason))
    else -> unavailable(ModelReasons.notReady(e.message ?: e.javaClass.simpleName))
  }

  private fun unavailable(detail: String) = EngineStartException(EngineStartError.MODEL_UNAVAILABLE, detail)

  private fun capped(cap: Int) = EngineStartException(EngineStartError.TOO_MANY_MODELS, ModelReasons.capped(cap))

  private fun stopped() = EngineStartException(EngineStartError.START_FAILED, "stopped while its model loaded")

  companion object {
    /** PHONECANDO_AGENT of every server's process: no agent id looks like it (they are hex). */
    const val TAG = "model-server"
    const val BINARY = "libllama-server.so"
    private const val LOG_TAG = "PhoneCanDoModels"
    private const val PROBE_CONNECT_MS = 2_000
    private const val PROBE_READ_MS = 5_000

    /** A model's server log name: model-server-<id>.log, the id kept to a-z, 0-9 and dashes (ModelIds allows no more). */
    fun logName(modelId: String): String =
      "$TAG-${modelId.lowercase().replace(Regex("[^a-z0-9-]"), "_").take(MAX_LOG_ID)}.log"

    private const val MAX_LOG_ID = 80
  }
}
