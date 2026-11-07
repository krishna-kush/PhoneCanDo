package com.phonecando.runner.api

import android.content.Context
import android.content.Intent
import android.os.SystemClock
import com.phonecando.runner.PhoneCanDoServeService
import com.phonecando.runner.agents.AgentKinds
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.EngineRequests
import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.Engines
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import kotlin.concurrent.thread

// The engines for JS (records.ts EngineStatus, EngineStartError). Slow
// calls take a Promise and run on their own thread: Expo's default async
// queue is one thread shared by every module, and a stop can take 3 s.
internal fun ModuleDefinitionBuilder.engineFunctions(context: () -> Context) {
  // Resolves { port } once the service launched the process and its port is
  // known (EngineSupervisor.start); an engine already starting or ready
  // resolves at once. Rejects with the EngineStartError code as the error
  // code and at the start of the message.
  AsyncFunction("startEngine") { agentId: String, promise: Promise ->
    val ctx = context()
    val engines = Engines.get(ctx)
    val running = engines.livePort(agentId)
    if (running != null) {
      engines.touch(agentId)
      promise.resolve(mapOf("port" to running.toString()))
    } else {
      val requestId = EngineRequests.register { result ->
        result.fold(
          onSuccess = { promise.resolve(mapOf("port" to it.toString())) },
          onFailure = { rejectStart(promise, it) },
        )
      }
      val intent = Intent(ctx, PhoneCanDoServeService::class.java)
        .setAction(PhoneCanDoServeService.ACTION_START)
        .putExtra(PhoneCanDoServeService.EXTRA_AGENT_ID, agentId)
        .putExtra(PhoneCanDoServeService.EXTRA_REQUEST_ID, requestId)
        // Boot time (telemetry) runs from this request.
        .putExtra(PhoneCanDoServeService.EXTRA_REQUESTED_AT, SystemClock.elapsedRealtime())
      try {
        ctx.startForegroundService(intent)
      } catch (e: Exception) {
        // Android refuses a foreground service start from the background.
        EngineRequests.complete(
          requestId,
          Result.failure(EngineStartException(EngineStartError.START_FAILED, "the engine service could not start (${e.javaClass.simpleName})")),
        )
      }
    }
  }

  AsyncFunction("stopEngine") { agentId: String, promise: Promise ->
    val engines = Engines.get(context())
    thread(name = "phonecando-engine-stop", isDaemon = true) {
      engines.stop(agentId)
      promise.resolve(null)
    }
  }

  // Resolves when no engine and no tagged process is left (the updater
  // calls it before a self-update).
  AsyncFunction("stopAllEngines") { promise: Promise ->
    val engines = Engines.get(context())
    thread(name = "phonecando-engine-stop-all", isDaemon = true) {
      engines.stopAll()
      // SIGKILLed processes take a moment to leave /proc.
      val deadline = SystemClock.elapsedRealtime() + KILL_SETTLE_MS
      while (engines.anyAlive() && SystemClock.elapsedRealtime() < deadline) Thread.sleep(50)
      promise.resolve(null)
    }
  }

  // Engines we run plus any process tagged with an agent; reads /proc.
  Function("isAnyEngineAlive") {
    Engines.get(context()).anyAlive()
  }

  // The user is working with this agent: keeps its engine from being the
  // one stopped to make room.
  Function("touchEngine") { agentId: String ->
    Engines.get(context()).touch(agentId)
  }

  Function("engineStatus") { agentId: String ->
    Engines.get(context()).status(agentId).toMap()
  }

  Function("engineStatuses") {
    Engines.get(context()).statuses().map { it.toMap() }
  }

  // { baseUrl, password } of the agent's engine. baseUrl is "" before its
  // first start; the agent kind decides how the password rides on a request.
  Function("getEngineAuth") { agentId: String ->
    val ctx = context()
    val record = AgentStores.get(ctx).get(agentId) ?: throw IllegalArgumentException("unknown agent")
    val port = Engines.get(ctx).livePort(agentId)?.toString() ?: record.port
    mapOf(
      "baseUrl" to (port?.let { "http://127.0.0.1:$it" } ?: ""),
      "password" to record.password,
    )
  }

  // "ok" | "starting" | "http-N" | "error:…": one probe with the kind's
  // health request and this agent's password. Synchronous (short timeouts).
  Function("engineHealth") { agentId: String ->
    val ctx = context()
    val record = AgentStores.get(ctx).get(agentId) ?: return@Function "error:unknown agent"
    val kind = AgentKinds.get(record.kind) ?: return@Function "error:unknown agent kind"
    val status = Engines.get(ctx).status(agentId)
    val starting = status.state == EngineState.STARTING
    val port = status.port ?: return@Function if (starting) "starting" else "error:${status.state.wire}"
    try {
      val code = kind.healthProbe(port, record.password).status(HEALTH_CONNECT_MS, HEALTH_READ_MS)
      when {
        code == 200 -> "ok"
        starting -> "starting"
        else -> "http-$code"
      }
    } catch (e: Exception) {
      if (starting) "starting" else "error:${e.message}"
    }
  }
}

private fun rejectStart(promise: Promise, e: Throwable) {
  val code = (e as? EngineStartException)?.error?.code ?: EngineStartError.START_FAILED.code
  val message = if (e is EngineStartException) e.message else "$code: ${e.message ?: e.javaClass.simpleName}"
  promise.reject(code, message, e)
}

private const val KILL_SETTLE_MS = 1_000L
private const val HEALTH_CONNECT_MS = 2_000
private const val HEALTH_READ_MS = 3_000
