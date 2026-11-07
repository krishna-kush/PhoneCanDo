package com.phonecando.runner.engine

import java.net.InetSocketAddress
import java.net.ServerSocket

// Loopback ports for every engine, behind one lock. An engine first tries
// its last-good port (kept in its agent record) when nothing of ours holds
// it and it is free; otherwise it takes an OS-assigned free port. Ports
// handed out stay reserved until release(), so two starts never get the same
// one even before either engine has bound it. Pure: the socket probes are
// passed in (LoopbackPorts on the phone).
class PortAllocator(
  private val isFree: (Int) -> Boolean,
  private val pickFree: () -> Int,
) {
  /** [squatted]: a last-good port was given but could not be used. */
  data class Allocation(val port: Int, val squatted: Boolean)

  private val reserved = HashSet<Int>()

  @Synchronized
  fun allocate(lastGood: Int?, avoid: Set<Int> = emptySet()): Allocation {
    if (lastGood != null && lastGood in PORTS && lastGood !in reserved && lastGood !in avoid && isFree(lastGood)) {
      reserved += lastGood
      return Allocation(lastGood, squatted = false)
    }
    repeat(MAX_PICKS) {
      val port = try {
        pickFree()
      } catch (_: Exception) {
        return@repeat
      }
      if (port in PORTS && port !in reserved && port !in avoid) {
        reserved += port
        return Allocation(port, squatted = lastGood != null)
      }
    }
    throw EngineStartException(EngineStartError.PORT_UNAVAILABLE, "no free loopback port")
  }

  @Synchronized
  fun release(port: Int) {
    reserved -= port
  }

  @Synchronized
  fun reserved(): Set<Int> = reserved.toSet()

  private companion object {
    val PORTS = 1..65535
    const val MAX_PICKS = 16
  }
}

/** The real probes: bind 127.0.0.1 and let go at once. */
object LoopbackPorts {
  fun isFree(port: Int): Boolean = try {
    ServerSocket().use { s ->
      s.reuseAddress = true
      s.bind(InetSocketAddress("127.0.0.1", port))
    }
    true
  } catch (_: Exception) {
    false
  }

  fun pickFree(): Int = ServerSocket().use { s ->
    s.bind(InetSocketAddress("127.0.0.1", 0))
    s.localPort
  }
}
