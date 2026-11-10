package com.phonecando.runner.engine

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.models.prompt.PromptReading
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicLong

// The process's one EngineSupervisor, and who hears about it: the
// foreground service (notification, stop when idle) and the native module
// (the phonecandoEngineState and phonecandoPromptReading events). Listeners
// run on the thread that changed the engine, never the main thread by
// default.
internal object Engines {
  interface Listener {
    fun onStatus(status: EngineStatus) {}

    /** No engine is starting, running or stopping any more. */
    fun onIdle() {}

    /** The chats the engines are busy with changed (EngineSupervisor.chats). */
    fun onChats() {}

    /** The model server's prompt reading changed (EngineSupervisor.promptReading); null: none. */
    fun onPrompt(reading: PromptReading?) {}
  }

  private val listeners = CopyOnWriteArrayList<Listener>()
  @Volatile private var supervisor: EngineSupervisor? = null

  fun get(context: Context): EngineSupervisor = supervisor ?: synchronized(this) {
    supervisor ?: EngineSupervisor(context.applicationContext ?: context, AgentStores.get(context), relay)
      .also { supervisor = it }
  }

  /** The supervisor if anything created it yet (nothing can run before that). */
  fun peek(): EngineSupervisor? = supervisor

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
