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
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.engine.spawn.ServerSpawner
import java.io.File
import kotlin.concurrent.thread

// The model slot: at most one local model server (lme's llama-server) at a
// time, outside the agents' cap of three. An agent bound to a model
// acquires it when its engine starts: the server is started on demand from
// lme-host's launch plan (libllama-server.so from the native-library dir,
// 127.0.0.1 on a port of ours, a fresh random key in its env, never its
// argv), and the start waits for /health to answer ready (Readiness: a 4B
// model took 27 s on our test phone). Every agent bound to the same model
// shares it; another model is refused while an agent runs on the first
// (ModelSlotPolicy). Each agent's lease ends with its engine (a stop, a
// failed start, a death); the last one stops the server (SIGTERM, SIGKILL
// after the grace). A server that dies by itself takes its agents down with
// it (onDied): their engines have its old URL and key. Its output goes to
// [logFile]; its process carries the tag PHONECANDO_AGENT=model-server, so
// a stop-all and the reaper of an earlier app process's leftovers find it.
// The lock guards the slot only: launching and waiting run outside it.
internal class ModelServer(
  private val ports: PortAllocator,
  private val reaper: ProcessReaper,
  /** The APK's native-library dir. */
  private val libDir: String,
  private val logFile: File,
  private val device: () -> DeviceInfo,
  /** A model's entry file in the store. */
  private val modelFile: (ModelRecord) -> File,
  /** The server of [holders]' model ended by itself; [detail] says how. */
  private val onDied: (holders: Set<String>, detail: String) -> Unit,
) {
  // One launch of the server. end() frees it once, from whichever thread
  // gets there first; a port or process attached after that is freed at once.
  private class Run(val model: ModelRecord) {
    @Volatile var process: EngineProcess? = null
      private set
    @Volatile var endpoint: ServedEndpoint? = null
    private var port: Int? = null
    private var ended = false

    val alive: Boolean get() = process?.isAlive ?: synchronized(this) { !ended }

    /** False when the run ended first: the caller frees [port]. */
    fun attachPort(port: Int): Boolean = synchronized(this) {
      if (!ended) this.port = port
      !ended
    }

    /** False when the run ended first: the caller ends [proc]. */
    fun attachProcess(proc: EngineProcess): Boolean = synchronized(this) {
      if (!ended) process = proc
      !ended
    }

    fun end(reaper: ProcessReaper, ports: PortAllocator) {
      val (proc, freed) = synchronized(this) {
        if (ended) return
        ended = true
        process to port
      }
      // Only its own process: a run that starts meanwhile carries the same tag.
      proc?.let { reaper.stop(listOf(it), emptySet()) }
      freed?.let(ports::release)
    }
  }

  private val lock = Any()
  private var run: Run? = null
  private val leases = LinkedHashSet<String>()

  /**
   * The server of [model] for [agentId]'s engine, started first when it is
   * not up; blocks while it loads. Throws EngineStartException
   * model_unavailable (with why) or start_failed (the agent was stopped
   * meanwhile); the agent holds no lease then.
   */
  fun acquire(agentId: String, model: ModelRecord): ServedEndpoint {
    val previous: Run?
    val orphans: Set<String>
    val mine: Run
    synchronized(lock) {
      val current = run
      val others = leases - agentId
      val decision = ModelSlotPolicy.decide(current?.model?.id, current?.endpoint != null, current?.alive == true, others, model.id)
      when (decision) {
        ModelSlotPolicy.Decision.Reuse -> {
          leases += agentId
          return checkNotNull(current?.endpoint)
        }
        is ModelSlotPolicy.Decision.Busy -> throw unavailable(ModelReasons.busy(current?.model?.name ?: decision.loadedModelId))
        ModelSlotPolicy.Decision.Start -> Unit
      }
      previous = current
      // Holders of a server that died before its watch told them: they go down below.
      orphans = others
      leases.clear()
      leases += agentId
      mine = Run(model)
      run = mine
    }
    previous?.end(reaper, ports)
    if (orphans.isNotEmpty()) onDied(orphans, ModelReasons.exited(previous?.model?.name ?: model.name, null))
    try {
      val endpoint = launch(mine)
      synchronized(lock) {
        if (run !== mine) throw stopped()
        mine.endpoint = endpoint
      }
      watch(mine)
      Log.i(LOG_TAG, "model ${model.id} ready for $agentId")
      return endpoint
    } catch (e: Exception) {
      synchronized(lock) {
        if (run === mine) {
          run = null
          leases.clear()
        }
      }
      mine.end(reaper, ports)
      throw asStartFailure(e, model.name)
    }
  }

  /** [agentId]'s engine is gone; the last holder stops the server. A starting server sees it and gives up. */
  fun release(agentId: String) {
    val ending = synchronized(lock) {
      if (!leases.remove(agentId) || leases.isNotEmpty()) return
      run.also { run = null }
    } ?: return
    Log.i(LOG_TAG, "no agent uses model ${ending.model.id} any more, stopping it")
    ending.end(reaper, ports)
  }

  /** The server that answers now: its model, endpoint and the agents holding it; null while none is ready. */
  fun serving(): Serving? = synchronized(lock) {
    val current = run ?: return null
    val endpoint = current.endpoint ?: return null
    Serving(current.model, endpoint, leases.toSet())
  }

  /** A ready server; [endpoint] keeps its key out of toString. */
  data class Serving(val model: ModelRecord, val endpoint: ServedEndpoint, val holders: Set<String>)

  /** Ends the server whoever holds it, and what an earlier app process left (stop all, the updater). */
  fun stopAll() {
    val ending = synchronized(lock) {
      leases.clear()
      run.also { run = null }
    }
    ending?.end(reaper, ports)
    reaper.stop(emptyList(), setOf(TAG))
  }

  // Plans, spawns and waits for ready; the run is the slot's while it does.
  private fun launch(mine: Run): ServedEndpoint {
    val exe = File(libDir, BINARY)
    if (!exe.isFile) throw unavailable(ModelReasons.noServer())
    // What an earlier app process left: its port and RAM are ours to take back.
    reaper.stop(emptyList(), setOf(TAG))
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
    Log.i(LOG_TAG, "model ${mine.model.id}: context ${plan.contextSize}, prompt cache ${plan.promptCacheMiB} MiB, ${plan.ram}")
    if (plan.ram is RamVerdict.OverBudget) Log.w(LOG_TAG, "model ${mine.model.id} runs past the RAM budget at its chosen context")
    logFile.parentFile?.mkdirs()
    val proc = ServerSpawner.spawn(plan.argv, env(plan), logFile.parentFile ?: File("/"), logFile)
    if (!mine.attachProcess(proc)) {
      reaper.stop(listOf(proc), emptySet())
      throw stopped()
    }
    if (synchronized(lock) { run !== mine }) throw stopped()
    val probe = HealthProbe(UrlConnectionPort(connectTimeoutMillis = PROBE_CONNECT_MS, readTimeoutMillis = PROBE_READ_MS))
    Readiness(probe = { probe.probe(plan.healthUrl) }, alive = { proc.isAlive })
      .await { synchronized(lock) { run !== mine } }
    return plan.endpoint
  }

  // Our process env, the plan's (its key), and the tag that makes it ours to reap.
  private fun env(plan: LaunchPlan): Map<String, String> {
    val env = LinkedHashMap(System.getenv())
    env.remove(EngineEnv.BRIDGE_URL)
    env.remove(EngineEnv.BRIDGE_TOKEN)
    env.putAll(plan.env)
    env[EngineEnv.AGENT] = TAG
    return env
  }

  // An exit nobody asked for: the slot is free, and its holders go down.
  private fun watch(mine: Run) {
    val proc = mine.process ?: return
    thread(name = "phonecando-model-watch", isDaemon = true) {
      val code = try {
        proc.waitFor()
      } catch (_: InterruptedException) {
        return@thread
      }
      val holders = synchronized(lock) {
        if (run !== mine) return@thread
        run = null
        leases.toSet().also { leases.clear() }
      }
      Log.w(LOG_TAG, "model server for ${mine.model.id} exited with $code")
      mine.end(reaper, ports)
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

  private fun stopped() = EngineStartException(EngineStartError.START_FAILED, "stopped while its model loaded")

  companion object {
    /** PHONECANDO_AGENT of the server's process: no agent id looks like it (they are hex). */
    const val TAG = "model-server"
    const val BINARY = "libllama-server.so"
    private const val LOG_TAG = "PhoneCanDoModels"
    private const val PROBE_CONNECT_MS = 2_000
    private const val PROBE_READ_MS = 5_000
  }
}
