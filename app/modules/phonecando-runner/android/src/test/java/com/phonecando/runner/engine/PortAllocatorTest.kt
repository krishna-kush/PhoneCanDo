package com.phonecando.runner.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger

// JVM checks for PortAllocator: last-good reuse, the reserved set, the
// fallback for a taken port, and concurrent starts never sharing a port.
class PortAllocatorTest {
  private val taken = HashSet<Int>()
  private val next = AtomicInteger(50_000)
  private val ports = PortAllocator(isFree = { it !in taken }, pickFree = { next.getAndIncrement() })

  @Test fun reusesTheLastGoodPortWhenFree() {
    assertEquals(PortAllocator.Allocation(4097, squatted = false), ports.allocate(4097))
    assertEquals(setOf(4097), ports.reserved())
  }

  @Test fun firstStartTakesAnOsPort() {
    assertEquals(PortAllocator.Allocation(50_000, squatted = false), ports.allocate(null))
  }

  @Test fun takenLastGoodFallsBackAndCountsAsSquat() {
    taken += 4097
    assertEquals(PortAllocator.Allocation(50_000, squatted = true), ports.allocate(4097))
  }

  @Test fun portReservedByAnotherEngineIsNotReused() {
    val a = ports.allocate(4097)
    // The second agent remembers the same port; the first one still holds it.
    val b = ports.allocate(4097)
    assertEquals(4097, a.port)
    assertEquals(50_000, b.port)
    assertTrue(b.squatted)
    ports.release(4097)
    assertEquals(4097, ports.allocate(4097).port)
  }

  @Test fun osPortThatIsReservedOrAvoidedIsSkipped() {
    val p = PortAllocator(isFree = { true }, pickFree = sequence(41_000, 41_000, 41_001, 41_002))
    assertEquals(41_000, p.allocate(null).port)
    assertEquals(41_001, p.allocate(null).port)
    val q = PortAllocator(isFree = { true }, pickFree = sequence(42_000, 42_001))
    assertEquals(42_001, q.allocate(null, avoid = setOf(42_000)).port)
    assertFalse(q.reserved().contains(42_000))
  }

  @Test fun noPortLeftIsTyped() {
    val p = PortAllocator(isFree = { false }, pickFree = { 43_000 })
    p.allocate(null)
    try {
      p.allocate(null)
      fail("a reserved port was handed out twice")
    } catch (e: EngineStartException) {
      assertEquals(EngineStartError.PORT_UNAVAILABLE, e.error)
      assertTrue(e.message!!.startsWith("port_unavailable:"))
    }
  }

  @Test fun concurrentStartsGetDistinctPorts() {
    // The OS keeps offering the same few ports, as it may right after a close.
    val offered = AtomicInteger()
    val p = PortAllocator(isFree = { true }, pickFree = { 44_000 + offered.getAndIncrement() % 4 })
    val got = Collections.synchronizedList(ArrayList<Int>())
    val go = CountDownLatch(1)
    val threads = (1..4).map { i ->
      Thread {
        go.await()
        got += p.allocate(if (i % 2 == 0) 44_001 else null).port
      }.also { it.start() }
    }
    go.countDown()
    threads.forEach { it.join() }
    assertEquals(4, got.toSet().size)
    assertEquals(got.toSet(), p.reserved())
  }

  private fun sequence(vararg values: Int): () -> Int {
    val i = AtomicInteger()
    return { values[minOf(i.getAndIncrement(), values.size - 1)] }
  }
}
