package com.phonecando.runner.engine.tui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ByteQueueTest {
  @Test fun takesAcrossParts() {
    val q = ByteQueue()
    assertNull(q.take(4))
    q.add("abc".toByteArray())
    q.add(ByteArray(0))
    q.add("defgh".toByteArray())
    assertEquals(8, q.size)
    assertEquals("ab", q.take(2)!!.toString(Charsets.UTF_8))
    assertEquals("cdef", q.take(4)!!.toString(Charsets.UTF_8))
    assertEquals("gh", q.take(100)!!.toString(Charsets.UTF_8))
    assertNull(q.take(1))
    q.add("x".toByteArray())
    q.clear()
    assertEquals(0, q.size)
    assertNull(q.take(1))
  }
}
