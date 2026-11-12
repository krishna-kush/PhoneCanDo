package com.phonecando.runner.engine.events

import com.phonecando.agents.kit.EngineEvent.Kind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the events file's lines (the kit scripts' format) and what
// the sink makes of them through a kind's hook map.
class EventSinkTest {
  @Test fun linesParse() {
    assertEquals(EventLine.Named("Stop"), EventLine.parse("Stop\tsess-1\tall done"))
    assertEquals(EventLine.Named("Notification"), EventLine.parse("Notification\t\t"))
    assertEquals(EventLine.Named("bare"), EventLine.parse("bare"))
    assertEquals(EventLine.Named("Stop"), EventLine.parse("Stop\t\t\r"))
    assertEquals(EventLine.Open("https://example.com/a?b=c\td"), EventLine.parse("@open\thttps://example.com/a?b=c\td"))
    assertNull(EventLine.parse("@open\t"))
    assertNull(EventLine.parse("@open"))
    assertNull(EventLine.parse("@close\thttps://example.com"))
    assertNull(EventLine.parse(""))
    assertNull(EventLine.parse("\tsess\tmsg"))
    assertEquals(EventLine.Inbox(listOf(12L, 13L)), EventLine.parse("@inbox\t12 13"))
    assertEquals(EventLine.Inbox(listOf(7L)), EventLine.parse("@inbox\t7 x -2 0 7\r"))
    assertNull(EventLine.parse("@inbox\t"))
    assertNull(EventLine.parse("@inbox\tnone"))
  }

  @Test fun anInboxReceiptGoesToItsOwnCallback() {
    val read = ArrayList<List<Long>>()
    val sink = EventSink(emptyMap(), {}, {}, onInbox = { read += it })
    sink.accept("@inbox\t3 4")
    sink.accept("Stop\t\t")
    assertEquals(listOf(listOf(3L, 4L)), read)
  }

  @Test fun theHookMapNamesTheEvents() {
    val events = ArrayList<Kind>()
    val opened = ArrayList<String>()
    val sink = EventSink(mapOf("Stop" to Kind.FINISHED, "Notification" to Kind.WAITING), events::add, opened::add)
    for (line in listOf("Stop\ts\t", "Unmapped\ts\t", "Notification\t\tneeds you", "@open\thttps://github.com/login/device", "garbage@")) {
      sink.accept(line)
    }
    assertEquals(listOf(Kind.FINISHED, Kind.WAITING), events)
    assertEquals(listOf("https://github.com/login/device"), opened)
  }
}
