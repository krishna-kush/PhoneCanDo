package com.phonecando.runner.models

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.serve.ServedEndpoint
import com.phonecando.runner.engine.PortAllocator
import com.phonecando.runner.engine.proc.EngineProcess
import com.phonecando.runner.engine.proc.ProcessReaper

// One launch of one model's server (ModelServer), and the agents holding
// it. close() ends it once, from whichever thread gets there first, and
// hands back what to free; a port or process attached after that is freed
// by the caller at once. [leases] and [endpoint] change only under
// ModelServer's lock.
internal class ModelRun(val model: ModelRecord) {
  @Volatile var process: EngineProcess? = null
    private set
  @Volatile var endpoint: ServedEndpoint? = null

  /** The agents whose engines run on it. */
  val leases = LinkedHashSet<String>()
  private var port: Int? = null
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

  /** What there is to free; null when it had already ended. */
  fun close(): Ending? = synchronized(this) {
    if (ended) return null
    ended = true
    Ending(process, port)
  }

  data class Ending(val process: EngineProcess?, val port: Int?)

  companion object {
    /**
     * Ends [runs] within one grace: only their own processes (a run that
     * starts meanwhile carries the same tag), plus every process tagged
     * [tags] (a stop-all's leftovers), then frees their ports.
     */
    fun end(runs: Collection<ModelRun>, reaper: ProcessReaper, ports: PortAllocator, tags: Set<String> = emptySet()) {
      val endings = runs.mapNotNull { it.close() }
      val procs = endings.mapNotNull { it.process }
      if (procs.isNotEmpty() || tags.isNotEmpty()) reaper.stop(procs, tags)
      endings.mapNotNull { it.port }.forEach(ports::release)
    }
  }
}
