package com.phonecando.runner.engine

import android.util.Log
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.HttpProbe
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.agents.kit.term.SignalRules
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.TelemetrySwitch
import com.phonecando.runner.engine.acp.AcpAgent
import com.phonecando.runner.engine.events.ActiveChats
import com.phonecando.runner.engine.events.EventFileTail
import com.phonecando.runner.engine.events.EventSink
import com.phonecando.runner.engine.events.EventTimers
import com.phonecando.runner.engine.events.HookMap
import com.phonecando.runner.engine.tui.EngineTerminal
import com.phonecando.runner.engine.tui.TuiEvents
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.notify.ChatTracker
import java.io.File

// Engine event streams: the supervisor opens one per ready engine, always:
// a server's SSE stream (with its kind's `chats.active`, a chat left
// working that its server no longer runs ends as a guessed stop:
// events/ActiveChats), or a TUI's output signals through its kind's PTY
// rules (TuiEvents), which also carry its chat title, together with its
// events file (events/: the kit scripts' lines, through the kind's hook map
// to the same events, links to open as open_url prompts, which go when
// the stream stops, `@inbox` receipts as other agents' messages read,
// messages/, and `@hook` lines, an inbox hook that ran, for the checks);
// a kind with hooks also has a run that shows nothing for a
// while after you typed into it (an Esc), or for a long while, end as
// stopped (TuiEvents.quiet). An ACP engine's events come
// from its driver (AcpAgent: its turns, AcpEvents); its hooks still write
// the events file, but ACP says how its run goes, so only their links,
// receipts and `@hook` lines are read there. Every event also goes to the
// capability checks (checks/: a turn's end, a task that started) and,
// after the alerts, to the scheduler (schedule/: a scheduled run's chat
// whose run ended gets its reply, whose notice takes the alert's place).
// Activity (any event the kind maps to something other than OTHER, so not
// heartbeats or catalog updates, nor a guessed stop: a quiet screen is no
// sign of use) marks the agent used, which keeps a working
// engine from being stopped to make room for another, whether or not
// anyone is looking at it, and is what its kind's idle rule reads. Every
// event also goes to the agent's alerts (finished, failed, waiting for your
// answer while PhoneCanDo is not in front) and to the chats the service
// notification lists. A run's end (a verdict, a stop or a deleted session)
// that leaves the agent no chat working or waiting for your answer is its
// `runEnded`: it gives back the screen it drove (Bridge.runEnded), so a
// later question does not pull PhoneCanDo forward (AgentAlerts). A
// subagent's verdict leaves its parent's chat working, so it never counts.
// Only while usage stats are on, a top-level session creation also counts
// once per agent and session id (a frame seen again after a reconnect does
// not count twice).
internal class EngineStreams(
  private val onActivity: (agentId: String) -> Unit,
  private val alerts: AgentAlerts,
  private val chats: ChatTracker,
  private val openUrl: (agentId: String, url: String) -> Unit,
  private val dropUrls: (agentId: String) -> Unit,
  private val inboxRead: (agentId: String, ids: List<Long>) -> Unit = { _, _ -> },
  private val runEnded: (agentId: String) -> Unit = {},
  /** Every event of every stream, for the checks (checks/). */
  private val checkEvent: (agentId: String, event: EngineEvent) -> Unit = { _, _ -> },
  /** Every event of every stream, after the alerts, for scheduled runs' replies (schedule/). */
  private val scheduleEvent: (agentId: String, event: EngineEvent) -> Unit = { _, _ -> },
  /** An `@hook` line: one of the kind's inbox hooks ran ([wait]: its waiting form), for the checks. */
  private val hookRan: (agentId: String, event: String, wait: Boolean) -> Unit = { _, _, _ -> },
) {
  // "<agentId> <sessionId>" already counted; bounded, oldest dropped first.
  private val createdSeen = object : LinkedHashMap<String, Boolean>() {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?): Boolean =
      size > CREATED_SEEN_MAX
  }

  /**
   * A started stream, or null when the kind has none; with the kind's
   * `chats.active`, its working chats are held against the server's
   * (ActiveChats).
   */
  fun open(agentId: String, kind: AgentKind, port: Int, password: String): EventSource? {
    val stream = kind.eventStream(port.toString(), password) ?: return null
    alerts.reset(agentId)
    chats.attach(agentId, kind, port, password)
    val active = kind.activeChats(port.toString(), password)?.let { probe ->
      ActiveChats(
        quietMs = (kind.idleQuietSec ?: ActiveChats.QUIET_DEFAULT_SEC) * 1000L,
        working = { chats.of(agentId).filter { it.state == ChatBoard.State.WORKING }.map { it.sessionId } },
        ask = { askActive(agentId, kind, probe) },
        stop = { sessionId -> onEvent(agentId, EngineEvent(EngineEvent.Kind.STOPPED, sessionId, guessed = true)) },
      )
    }
    val sse = SseClient(stream, TAG, "phonecando-sse-$agentId", kind::parseEvent) { event ->
      if (event.kind != EngineEvent.Kind.OTHER) active?.heard()
      onEvent(agentId, event)
    }.also { it.start() }
    val look = active?.let { a -> EventTimers.every(ActiveChats.TICK_MS) { a.tick() } }
    return EventSource {
      look?.stop()
      sse.stop()
    }
  }

  // The chats [agentId]'s server runs now; null when it did not answer.
  private fun askActive(agentId: String, kind: AgentKind, probe: HttpProbe): Set<String>? = try {
    val conn = probe.open(ACTIVE_CONNECT_MS, ACTIVE_READ_MS)
    try {
      if (conn.responseCode != 200) null else kind.parseActiveChats(conn.inputStream.bufferedReader().use { it.readText() })
    } finally {
      conn.disconnect()
    }
  } catch (e: Exception) {
    Log.w(TAG, "running chats of $agentId not read: ${e.javaClass.simpleName}")
    null
  }

  /** A TUI engine's events, from the signals in [terminal]'s output and the lines of [eventsFile] from now on. */
  fun openTui(agentId: String, kind: ManifestKind, terminal: EngineTerminal, eventsFile: File): EventSource {
    alerts.reset(agentId)
    val events = TuiEvents(SignalRules(kind.ptyRules), kind.chatTitle?.let(::Regex), terminal.windowTitle) { event ->
      try {
        onEvent(agentId, event)
      } catch (e: Exception) {
        Log.w(TAG, "engine event not handled", e)
      }
    }
    terminal.listen(events::onSignals)
    val hooks = HookMap.of(kind)
    val lines = sink(agentId, hooks, events::raise)
    val tail = EventFileTail(eventsFile, lines::accept).start()
    // Hooks may never say a run ended (an interrupt): a quiet screen does.
    val quiet = if (hooks.isEmpty()) null else EventTimers.every(QUIET_CHECK_MS) { events.quiet(terminal.lastOutputAt, terminal.lastInputAt) }
    return EventSource {
      terminal.listen(null)
      tail.stop()
      quiet?.stop()
      dropUrls(agentId)
    }
  }

  /** An ACP engine's events: its driver's, and the links and receipts in [eventsFile] from now on. */
  fun openAcp(agentId: String, acp: AcpAgent, eventsFile: File): EventSource {
    alerts.reset(agentId)
    acp.events = { event ->
      try {
        onEvent(agentId, event)
      } catch (e: Exception) {
        Log.w(TAG, "engine event not handled", e)
      }
    }
    val lines = sink(agentId, emptyMap()) {}
    val tail = EventFileTail(eventsFile, lines::accept).start()
    return EventSource {
      acp.events = null
      tail.stop()
      dropUrls(agentId)
    }
  }

  // An events file's lines: names through [hooks] to [raise], links to
  // open, inbox receipts, hooks that ran.
  private fun sink(agentId: String, hooks: Map<String, EngineEvent.Kind>, raise: (EngineEvent.Kind) -> Unit) = EventSink(
    hooks,
    raise,
    onOpen = { url ->
      try {
        openUrl(agentId, url)
      } catch (e: Exception) {
        Log.w(TAG, "link to open not handled", e)
      }
    },
    onInbox = { ids ->
      try {
        inboxRead(agentId, ids)
      } catch (e: Exception) {
        Log.w(TAG, "inbox receipt not handled", e)
      }
    },
    onHook = { event, wait ->
      try {
        hookRan(agentId, event, wait)
      } catch (e: Exception) {
        Log.w(TAG, "hook line not handled", e)
      }
    },
  )

  private fun onEvent(agentId: String, event: EngineEvent) {
    try {
      checkEvent(agentId, event)
    } catch (e: Exception) {
      Log.w(TAG, "engine event not checked", e)
    }
    if (event.sessionCreated && TelemetrySwitch.isEnabled()) countCreated(agentId, event.sessionId)
    if ((event.kind != EngineEvent.Kind.OTHER && !event.guessed) || event.sessionCreated) onActivity(agentId)
    alerts.onEvent(agentId, event)
    chats.onEvent(agentId, event)
    if (event.sessionId != null && event.kind in RUN_ENDS && !chats.busy(agentId)) runEnded(agentId)
    try {
      scheduleEvent(agentId, event)
    } catch (e: Exception) {
      Log.w(TAG, "engine event not heard by the schedules", e)
    }
  }

  private fun countCreated(agentId: String, sessionId: String?) {
    if (sessionId != null) {
      synchronized(createdSeen) {
        if (createdSeen.put("$agentId $sessionId", true) != null) return
      }
    }
    TelemetryRecorder.sessionCreated()
  }

  private companion object {
    const val TAG = "PhoneCanDoEngineSse"
    const val CREATED_SEEN_MAX = 256
    const val QUIET_CHECK_MS = 5_000L
    const val ACTIVE_CONNECT_MS = 1_000
    const val ACTIVE_READ_MS = 3_000
    val RUN_ENDS = setOf(EngineEvent.Kind.FINISHED, EngineEvent.Kind.FAILED, EngineEvent.Kind.STOPPED, EngineEvent.Kind.GONE)
  }
}
