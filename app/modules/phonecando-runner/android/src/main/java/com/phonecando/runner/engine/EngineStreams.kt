package com.phonecando.runner.engine

import android.util.Log
import com.phonecando.agents.kit.AgentKind
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.agents.kit.term.SignalRules
import com.phonecando.runner.TelemetryRecorder
import com.phonecando.runner.TelemetrySwitch
import com.phonecando.runner.engine.events.EventFileTail
import com.phonecando.runner.engine.events.EventSink
import com.phonecando.runner.engine.events.EventTimers
import com.phonecando.runner.engine.events.HookMap
import com.phonecando.runner.engine.tui.EngineTerminal
import com.phonecando.runner.engine.tui.TuiEvents
import com.phonecando.runner.notify.AgentAlerts
import com.phonecando.runner.notify.ChatTracker
import java.io.File

// Engine event streams: the supervisor opens one per ready engine, always:
// a server's SSE stream, or a TUI's output signals through its kind's PTY
// rules (TuiEvents), which also carry its chat title, together with its
// events file (events/: the kit scripts' lines, through the kind's hook map
// to the same events, links to open as open_url prompts, which go when
// the stream stops, and `@inbox` receipts as other agents' messages read,
// messages/); a kind with hooks also has a run that shows nothing for a
// while end as stopped (TuiEvents.quiet).
// Activity (any event the kind maps to something other than OTHER, so not
// heartbeats or catalog updates) marks the agent used, which keeps a working
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
) {
  // "<agentId> <sessionId>" already counted; bounded, oldest dropped first.
  private val createdSeen = object : LinkedHashMap<String, Boolean>() {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?): Boolean =
      size > CREATED_SEEN_MAX
  }

  /** A started stream, or null when the kind has none. */
  fun open(agentId: String, kind: AgentKind, port: Int, password: String): EventSource? {
    val stream = kind.eventStream(port.toString(), password) ?: return null
    alerts.reset(agentId)
    chats.attach(agentId, kind, port, password)
    return SseClient(stream, TAG, "phonecando-sse-$agentId", kind::parseEvent) { onEvent(agentId, it) }
      .also { it.start() }
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
    val sink = EventSink(
      hooks,
      events::raise,
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
    )
    val tail = EventFileTail(eventsFile, sink::accept).start()
    // Hooks may never say a run ended (an interrupt): a quiet screen does.
    val quiet = if (hooks.isEmpty()) null else EventTimers.every(QUIET_CHECK_MS) { events.quiet(terminal.lastOutputAt) }
    return EventSource {
      terminal.listen(null)
      tail.stop()
      quiet?.stop()
      dropUrls(agentId)
    }
  }

  private fun onEvent(agentId: String, event: EngineEvent) {
    if (event.sessionCreated && TelemetrySwitch.isEnabled()) countCreated(agentId, event.sessionId)
    if (event.kind != EngineEvent.Kind.OTHER || event.sessionCreated) onActivity(agentId)
    alerts.onEvent(agentId, event)
    chats.onEvent(agentId, event)
    if (event.sessionId != null && event.kind in RUN_ENDS && !chats.busy(agentId)) runEnded(agentId)
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
    val RUN_ENDS = setOf(EngineEvent.Kind.FINISHED, EngineEvent.Kind.FAILED, EngineEvent.Kind.STOPPED, EngineEvent.Kind.GONE)
  }
}
