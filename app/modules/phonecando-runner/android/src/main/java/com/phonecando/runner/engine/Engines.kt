package com.phonecando.runner.engine

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.engine.work.WorkWatch
import com.phonecando.runner.engine.work.WorkWatches
import com.phonecando.runner.limits.RunLimitStore
import com.phonecando.runner.memory.MemoryGuard
import com.phonecando.runner.memory.MemoryGuards
import com.phonecando.runner.memory.MemoryStatus
import com.phonecando.runner.models.prompt.PromptReading
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicLong

// The process's one EngineSupervisor with its memory guard (memory/) and
// work watch (work/: the jobs agents left running, the idle stop), and
// who hears about them: the foreground service (notification, wake lock,
// stop when idle) and the native module (the phonecandoEngineState,
// phonecandoPromptReading and phonecandoMemory events). The supervisor
// holds to the user's run limits (RunLimitStore). Listeners run on the
// thread that changed the engine, never the main thread by default.
internal object Engines {
  interface Listener {
    fun onStatus(status: EngineStatus) {}

    /** No engine is starting, running or stopping any more. */
    fun onIdle() {}

    /** The chats the engines are busy with changed (EngineSupervisor.chats). */
    fun onChats() {}

    /** A model server's prompt reading changed (EngineSupervisor.promptReading); null: none. */
    fun onPrompt(reading: PromptReading?) {}

    /** The memory guard's reading changed, or is not ok (MemoryGuard). */
    fun onMemory(status: MemoryStatus) {}

    /** The work watch looked (WorkWatch, every POLL_MS while an engine runs); [changed]: an agent's jobs did. */
    fun onWork(changed: Boolean) {}
  }

  private val listeners = CopyOnWriteArrayList<Listener>()
  @Volatile private var supervisor: EngineSupervisor? = null
  @Volatile private var guard: MemoryGuard? = null
  @Volatile private var workWatch: WorkWatch? = null

  fun get(context: Context): EngineSupervisor = supervisor ?: synchronized(this) {
    supervisor ?: create(context.applicationContext ?: context).also { supervisor = it }
  }

  /** The supervisor if anything created it yet (nothing can run before that). */
  fun peek(): EngineSupervisor? = supervisor

  /** The memory guard, made with the supervisor. */
  fun memory(context: Context): MemoryGuard {
    get(context)
    return checkNotNull(guard)
  }

  /** The work watch, made with the supervisor; null before anything created it. */
  fun work(): WorkWatch? = workWatch

  private fun create(app: Context): EngineSupervisor {
    val limits = RunLimitStore.get(app)
    val engines = EngineSupervisor(app, AgentStores.get(app), relay, limits = limits::read)
    guard = MemoryGuards.install(app, engines) { relay.onMemory(it) }
    workWatch = WorkWatches.install(app, engines) { relay.onWork(it) }
    return engines
  }

  fun addListener(listener: Listener) {
    listeners.addIfAbsent(listener)
  }

  fun removeListener(listener: Listener) {
    listeners.remove(listener)
  }

  private val relay = object : Listener {
    override fun onStatus(status: EngineStatus) = each { it.onStatus(status) }

    override fun onIdle() = each { it.onIdle() }

    override fun onChats() = each { it.onChats() }

    override fun onPrompt(reading: PromptReading?) = each { it.onPrompt(reading) }

    override fun onMemory(status: MemoryStatus) = each { it.onMemory(status) }

    override fun onWork(changed: Boolean) = each { it.onWork(changed) }

    private inline fun each(block: (Listener) -> Unit) {
      for (l in listeners) {
        try {
          block(l)
        } catch (t: Throwable) {
          Log.w("PhoneCanDoEngines", "engine listener failed", t)
        }
      }
    }
  }
}

// Start requests in flight between the module (a JS promise) and the
// service (which runs the start): the module registers a callback and puts
// its id in the start intent; the service completes it with the port (null
// for a TUI engine) or the failure. An unknown or repeated id is ignored.
internal object EngineRequests {
  private val pending = ConcurrentHashMap<String, (Result<Int?>) -> Unit>()
  private val next = AtomicLong()

  fun register(callback: (Result<Int?>) -> Unit): String {
    val id = "start-${next.incrementAndGet()}"
    pending[id] = callback
    return id
  }

  fun complete(id: String?, result: Result<Int?>) {
    val callback = id?.let(pending::remove) ?: return
    try {
      callback(result)
    } catch (t: Throwable) {
      Log.w("PhoneCanDoEngines", "start callback failed", t)
    }
  }
}
