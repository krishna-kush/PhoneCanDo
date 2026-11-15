package com.phonecando.runner.engine.events

import com.phonecando.agents.kit.EngineEvent.Kind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for the events file's lines (the kit scripts' format, the
// `@hook` lines for the capability checks among them) and what the sink
// makes of them through a kind's hook map.
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
    assertEquals(EventLine.Hook("Stop", wait = false), EventLine.parse("@hook\tStop"))
    assertEquals(EventLine.Hook("Stop", wait = true), EventLine.parse("@hook\tStop\twait\r"))
    assertEquals(EventLine.Hook("post_tool", wait = false), EventLine.parse("@hook\tpost_tool\r"))
    assertNull(EventLine.parse("@hook"))
    assertNull(EventLine.parse("@hook\t"))
    assertNull(EventLine.parse("@hook\t\twait"))
    assertNull(EventLine.parse("@hook\tStop\tlater"))
    assertNull(EventLine.parse("@hook\tStop\twait\textra"))
  }

  @Test fun anInboxReceiptGoesToItsOwnCallback() {
    val read = ArrayList<List<Long>>()
    val sink = EventSink(emptyMap(), {}, {}, onInbox = { read += it })
    sink.accept("@inbox\t3 4")
    sink.accept("Stop\t\t")
    assertEquals(listOf(listOf(3L, 4L)), read)
  }

  @Test fun aHookLineGoesToItsOwnCallback() {
    val ran = ArrayList<Pair<String, Boolean>>()
    val events = ArrayList<Kind>()
    val sink = EventSink(mapOf("Stop" to Kind.FINISHED), events::add, {}, onHook = { event, wait -> ran += event to wait })
    sink.accept("@hook\tStop")
    sink.accept("@hook\tStop\twait")
    sink.accept("@hook\tStop\tsoon")
    // A hook line is no named event: the hook map never sees it.
    assertEquals(listOf("Stop" to false, "Stop" to true), ran)
    assertEquals(emptyList<Kind>(), events)
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
