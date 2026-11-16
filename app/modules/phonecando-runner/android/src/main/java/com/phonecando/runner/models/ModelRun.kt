package com.phonecando.runner.models

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.runner.engine.PortAllocator
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.proc.ProcessReaper
import com.phonecando.runner.models.chats.ChatRelay

// One launch of one model's server (ModelServer), and the agents holding
// it. close() ends it once, from whichever thread gets there first, and
// hands back what to free; a port, process or go-between attached after
// that is freed by the caller at once. [leases], [endpoint] and
// [agentEndpoint] change only under ModelServer's lock.
internal class ModelRun(val model: ModelRecord) {
  @Volatile var process: EngineProcess? = null
    private set

  /** The server's own endpoint: its readiness, its /slots for the prompt watch. */
  @Volatile var endpoint: ServedEndpoint? = null

  /** What agents get: the go-between's (ChatRelay) when chats are kept on storage, else the server's. */
  @Volatile var agentEndpoint: ServedEndpoint? = null

  /** The go-between in front of it, while chats are kept on storage. */
  @Volatile var relay: ChatRelay? = null
    private set

  /** What its server takes from free memory, as its plan counted it at the launch (LaunchPlan.heldBytes). */
  @Volatile var heldBytes: Long = 0

  /** The agents whose engines run on it. */
  val leases = LinkedHashSet<String>()
  private var port: Int? = null
  private var relayPort: Int? = null
  private var ended = false

  /** Its process runs, or is being launched. */
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

  /** False when the run ended first: the caller closes [relay] and frees [port]. */
  fun attachRelay(relay: ChatRelay, port: Int): Boolean = synchronized(this) {
    if (!ended) {
      this.relay = relay
      relayPort = port
    }
    !ended
  }

  /** What there is to free; null when it had already ended. */
  fun close(): Ending? = synchronized(this) {
    if (ended) return null
    ended = true
    Ending(process, port, relay, relayPort)
  }

  data class Ending(val process: EngineProcess?, val port: Int?, val relay: ChatRelay? = null, val relayPort: Int? = null)

  companion object {
    /**
     * Ends [runs] within one grace: their go-betweens, only their own
     * processes (a run that starts meanwhile carries the same tag), plus
     * every process tagged [tags] (a stop-all's leftovers), then frees
     * their ports.
     */
    fun end(runs: Collection<ModelRun>, reaper: ProcessReaper, ports: PortAllocator, tags: Set<String> = emptySet()) {
      val endings = runs.mapNotNull { it.close() }
      // The go-betweens first: their open exchanges close, which stops the servers' work.
      endings.mapNotNull { it.relay }.forEach(ChatRelay::close)
      val procs = endings.mapNotNull { it.process }
      if (procs.isNotEmpty() || tags.isNotEmpty()) reaper.stop(procs, tags)
      endings.flatMap { listOfNotNull(it.port, it.relayPort) }.forEach(ports::release)
    }
  }
}
