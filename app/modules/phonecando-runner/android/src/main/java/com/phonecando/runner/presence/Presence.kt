package com.phonecando.runner.presence

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.bridge.ScreenLease
import com.phonecando.runner.engine.stop.TurnStop
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

// The agents' presence on the phone, and its one entry point: who drives
// the screen (the lease), the hand-over to you (PresenceStore, by the
// HandsRules) and each agent's status line. The open bridge attaches its
// lease; with none open nobody drives and nothing is handed over.
// While you have the controls the agent's time on the screen stands still
// (the lease's promptOpened, then promptClosed keeping it), nobody else is
// handed the screen (the router's HandsGate), and a run of its that ends
// keeps the screen until you leave it. Let me is a pause: the agent waits
// and goes on in the same turn. Stop really stops: its turn is stopped at
// once where its kind can (engine/stop/TurnStop: an ACP turn cancelled, a
// server's running chats interrupted), and it is told to end its turn at
// its next screen call. The note to go on
// (Resume) runs on our own thread.
// Every change goes to the overlay ([view], set by the full build's
// accessibility service) and to the app (PresenceEvents), only when the
// frame changed or a new view came up: at once on a change here or a
// granted screen request, otherwise on the bridge's tick each second, so
// the driver fades with its lease. A status change also redraws the
// service's notification (status listeners).
object Presence {
  private const val TAG = "PhoneCanDoPresence"

  /** The overlay, set by the full build's accessibility service; null elsewhere. */
  @Volatile
  var view: PresenceView? = null

  @Volatile
  private var lease: ScreenLease? = null

  @Volatile
  private var alive: (agentId: String) -> Boolean = { false }

  @Volatile
  private var app: Context? = null

  // Where each agent was as its hand-over began, for the note to go on.
  private val spots = ConcurrentHashMap<String, Resume.Spot>()

  private val io = Executors.newSingleThreadExecutor { r -> Thread(r, "phonecando-presence").apply { isDaemon = true } }

  private val statusListeners = CopyOnWriteArrayList<() -> Unit>()

  private val effects = object : PresenceStore.Effects {
    override fun target(): ScreenLease.Seat? = lease?.let { it.driver() ?: it.holder() }

    override fun freeze(seat: ScreenLease.Seat) {
      app?.let { spots[seat.agentId] = Resume(it).spot(seat.agentId) }
      lease?.promptOpened(seat.agentId, seat.name, alive)
    }

    override fun thaw(agentId: String, giveBack: Boolean) {
      lease?.promptClosed(agentId, keep = true)
      if (giveBack) lease?.runEnded(agentId)
    }

    override fun stopTurn(agentId: String) {
      val context = app ?: return
      later { TurnStop(context).stop(agentId) }
    }

    override fun resume(agentId: String, after: HandMode) {
      val context = app ?: return
      val spot = spots[agentId]
      later { Resume(context).send(agentId, after, spot) }
    }

    override fun changed() = publish()
  }

  /** The hand-over and the statuses; the bridge's routes act on it. */
  val store = PresenceStore({ SystemClock.elapsedRealtime() }, effects)

  /** The presence now. */
  fun frame(): PresenceFrame = store.frame(lease?.driver())

  /** A button of yours (the mascot, the app, a notification); false when it does not apply now. Off the main thread. */
  fun user(act: UserAct): Boolean = store.user(act)

  /** The bridge opened with [screen]: its driver and holder are what the hands work on. */
  fun attach(context: Context, screen: ScreenLease, alive: (agentId: String) -> Boolean) {
    app = context.applicationContext ?: context
    this.alive = alive
    lease = screen
    publish()
  }

  /** The bridge with [screen] stopped: nobody drives a phone with no bridge. */
  fun detach(screen: ScreenLease) {
    if (lease !== screen) return
    lease = null
    spots.clear()
    store.clear()
    publish()
  }

  /**
   * [agentId]'s run ended: its status goes. False tells the bridge to give
   * back the screen it held; true keeps it, its hand-over being on.
   */
  fun runEnded(agentId: String): Boolean = store.runEnded(agentId)

  /** [agentId]'s engine is gone: its hand-over ends with no note and its status goes. */
  fun forget(agentId: String) {
    spots.remove(agentId)
    store.forget(agentId)
  }

  /** The bridge's second: stale statuses go, and a driver whose lease ran out fades. */
  fun tick() {
    store.tick()
    publish()
  }

  fun addStatusListener(listener: () -> Unit) {
    statusListeners += listener
  }

  fun removeStatusListener(listener: () -> Unit) {
    statusListeners -= listener
  }

  private var told: PresenceView? = null
  private var shown: PresenceFrame? = null

  /** Tells the view and the app when the frame changed (or a new view came up). */
  @Synchronized
  fun publish() {
    val frame = frame()
    val now = view
    if (now === told && frame == shown) return
    val before = shown
    told = now
    shown = frame
    now?.let { runCatching { it.show(frame) }.onFailure { e -> Log.w(TAG, "overlay not told", e) } }
    if (frame == before) return
    PresenceEvents.send(frame)
    if (lines(frame) != before?.let(::lines)) statusListeners.forEach { runCatching { it() } }
  }

  // What a status shows, without when it was set.
  private fun lines(frame: PresenceFrame) = frame.statuses.mapValues { (_, s) -> s.text to s.mood }

  private fun later(block: () -> Unit) {
    io.execute {
      try {
        block()
      } catch (e: Exception) {
        Log.w(TAG, "presence step failed", e)
      }
    }
  }
}
