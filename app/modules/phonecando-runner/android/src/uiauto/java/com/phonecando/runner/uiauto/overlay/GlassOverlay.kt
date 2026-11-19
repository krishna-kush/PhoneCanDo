package com.phonecando.runner.uiauto.overlay

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.View
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.notify.AppOnScreen
import com.phonecando.runner.notify.LaunchTarget
import com.phonecando.runner.notify.LaunchTargets
import com.phonecando.runner.presence.GlassScheme
import com.phonecando.runner.presence.MascotFigures
import com.phonecando.runner.presence.Presence
import com.phonecando.runner.presence.PresenceFrame
import com.phonecando.runner.presence.PresenceView
import com.phonecando.runner.presence.UserAct
import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.figure.FiguresJson
import com.phonecando.runner.presence.glass.figure.PlainFigures
import com.phonecando.runner.presence.glass.motion.Chain
import com.phonecando.runner.presence.glass.motion.Moves
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.scene.Act
import com.phonecando.runner.presence.glass.scene.Button
import com.phonecando.runner.presence.glass.scene.GlassCopy
import com.phonecando.runner.presence.glass.scene.Glow
import com.phonecando.runner.presence.glass.scene.Own
import com.phonecando.runner.presence.glass.scene.Scene
import com.phonecando.runner.presence.glass.scene.Show
import com.phonecando.runner.presence.glass.walls.Beside
import com.phonecando.runner.presence.glass.walls.Bin
import com.phonecando.runner.presence.glass.walls.BinSpot
import com.phonecando.runner.presence.glass.walls.Dodge
import com.phonecando.runner.presence.glass.walls.Entrance
import com.phonecando.runner.presence.glass.walls.Exit
import com.phonecando.runner.presence.glass.walls.Fling
import com.phonecando.runner.presence.glass.walls.Perch
import com.phonecando.runner.presence.glass.walls.Room
import com.phonecando.runner.presence.glass.walls.Wall
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext

// The agent's own mascot on the glass, over every app: it comes in when
// an agent drives the phone and lives on the screen's walls (presence/
// glass, pure: where it sticks, how it moves, what it shows), the edge lit
// behind it. While it drives it stands side on, saying its status; tap it
// for Let me and Stop. Handed over to you, it turns to you (watching) or
// turns its back (paused), then sleeps in a corner until you start it
// again. Nobody driving and nothing handed over, it hops off the screen.
// You can drag it and throw it to another wall; paused, a bin comes up as
// you drag, and dropped on it the agent is left stopped (Leave it).
//
// The agent never meets it (GuardedBackend): a screenshot is taken with
// the glass see-through, and a touch of the agent's first tells it where
// (it looks there, and moves along its wall out of the way) and lands with
// the glass letting touches through.
//
// You touching the screen yourself while the agent drives (TouchWatch)
// counts as Let me: it watches instead of fighting you for the phone.
//
// Presence tells it the frame (show, off the main thread); its buttons go
// to Presence.user, off the main thread too. Window work runs on the main
// thread.
internal class GlassOverlay(private val service: AccessibilityService) : PresenceView, OverlayGuard, GripHand {
  private val main = Handler(Looper.getMainLooper())
  private val windows = GlassWindows(service)

  // Main thread only.
  private var target: Scene? = null
  private var scene: Scene? = null
  private var perch: Perch? = null
  private var remembered: Perch? = null
  private var figuresJson: String? = null
  private var waitingRoom = false
  private var entering = false
  private var leaving = false
  private var dragging = false

  // Dropped in the bin: on its way in (binned), and in (dropped).
  private var binned = false
  private var dropped = false
  private var controls = false
  private var rested = false
  private var folded = false
  private var hides = 0
  private var throughs = 0

  // When the agent's last touch was let through, and a Let me of your touch on its way.
  private var agentTouchedAt = 0L
  private var takingOver = false
  private val closeControls = Runnable {
    if (controls) {
      controls = false
      refresh()
    }
  }
  private val figuresChanged: (String) -> Unit = { id -> main.post { if (scene?.agentId == id) loadFigures(id) } }
  private val schemeChanged: () -> Unit = { main.post { recolor() } }

  // The glass's colours while its windows are up; read again when the theme changes.
  private var palette: Palette? = null

  init {
    MascotFigures.listener = figuresChanged
    GlassScheme.listener = schemeChanged
  }

  /** The phone's light or dark changed (the service heard it): the glass follows, unless the app set its own. */
  fun themeChanged() {
    main.post { recolor() }
  }

  // The theme changed with the glass up: every colour now, not at the next drive.
  private fun recolor() {
    val colors = palette ?: return
    colors.load(GlassScheme.themed(service))
    windows.card?.recolor()
    windows.views().forEach { it.invalidate() }
  }

  override fun show(frame: PresenceFrame) {
    val next = Scene.of(frame)
    main.post { update(next) }
  }

  /** The service is going: the windows go with it. */
  fun close() {
    if (MascotFigures.listener === figuresChanged) MascotFigures.listener = null
    if (GlassScheme.listener === schemeChanged) GlassScheme.listener = null
    main.post {
      target = null
      scene = null
      perch = null
      main.removeCallbacks(closeControls)
      windows.close()
    }
  }

  private fun update(next: Scene?) {
    target = next
    if (leaving) return
    val now = scene
    when {
      now == null -> if (next != null) enter(next)
      next == null || next.agentId != now.agentId -> leave()
      else -> {
        if (next.act != now.act || next.since != now.since) {
          controls = false
          folded = false
          rested = false
        }
        scene = next
        refresh()
      }
    }
  }

  private fun enter(next: Scene) {
    if (!windows.open) {
      // The app's light or dark, read as the glass comes up.
      val palette = Palette(GlassScheme.themed(service)).also { this.palette = it }
      val stage = StageView(service, palette).apply { onRoom = ::roomChanged }
      val grip = GripView(service, this)
      val card = CardView(service, palette, ::press)
      val watch = TouchWatch(service, ::youTouched)
      if (!windows.open(stage, grip, card, watch)) return
      // A new stage starts as plain A-01: whatever figures the last one had are gone with it.
      figuresJson = null
      if (hides > 0) windows.views().forEach { it.alpha = 0f }
    }
    scene = next
    controls = false
    rested = false
    folded = false
    loadFigures(next.agentId)
    val stage = windows.stage ?: return
    stage.show = show()
    val room = stage.room
    if (room == null) {
      // Its first layout tells the screen's size and bars (roomChanged).
      waitingRoom = true
      return
    }
    comeIn(room)
  }

  private fun comeIn(room: Room) {
    val stage = windows.stage ?: return
    val body = stage.body()
    val at = room.toSide(remembered ?: room.home(body), body)
    perch = at
    stage.wall = at.wall
    entering = true
    windows.grip(null)
    windows.card(null)
    stage.play(Entrance.move(room, body, at), Facing.SIDE to Eyes.WIDE) {
      entering = false
      settled()
    }
  }

  private fun leave() {
    val stage = windows.stage
    val room = stage?.room
    val pose = stage?.pose()
    val at = perch
    controls = false
    main.removeCallbacks(closeControls)
    windows.grip(null)
    windows.card(null)
    if (binned) {
      // Dropped in the bin: it is gone once it has sunk in.
      leaving = true
      stage?.show = stage?.show?.copy(glow = Glow.OFF, bubble = null, thinking = false)
      if (dropped) {
        leaving = false
        gone()
      }
      return
    }
    if (stage == null || room == null || pose == null || at == null) {
      gone()
      return
    }
    leaving = true
    remembered = at
    // Nothing left to drive: the glow and its words go before it does.
    stage.show = stage.show?.copy(glow = Glow.OFF, bubble = null, thinking = false)
    stage.play(Exit.move(room, stage.body(), at.wall, pose), Facing.SIDE to Eyes.DOT) {
      leaving = false
      gone()
    }
  }

  private fun gone() {
    scene = null
    perch = null
    entering = false
    dragging = false
    binned = false
    dropped = false
    windows.stage?.let {
      it.bin = null
      it.binArmed = false
    }
    val next = target
    if (next == null) windows.close() else enter(next)
  }

  private fun show(): Show? = scene?.let { Show.of(it, controls, rested, folded) }

  private fun refresh() {
    val s = scene ?: return
    val stage = windows.stage ?: return
    val show = Show.of(s, controls, rested, folded)
    stage.show = show
    windows.grip?.contentDescription = GlassCopy.mascot(s, show)
    placeCard()
  }

  // It came to rest: its grip goes over it and its card beside it.
  private fun settled() {
    val stage = windows.stage ?: return
    val room = stage.room ?: return
    val at = perch ?: return
    if (dragging || entering || leaving || binned) return
    windows.grip(room.area(room.pose(at, stage.body()), stage.body()))
    placeCard()
  }

  private fun placeCard() {
    val s = scene ?: return
    val stage = windows.stage ?: return
    val room = stage.room
    val at = perch
    val copy = show()?.let { GlassCopy.card(it.card, s) }
    if (copy == null || room == null || at == null || entering || leaving || dragging || binned) {
      windows.card(null)
      return
    }
    windows.card?.bind(copy)
    val gap = CARD_GAP_DP * service.resources.displayMetrics.density
    val (w, h) = windows.cardSize((room.w - room.inLeft - room.inRight - gap * 2).toInt())
    val body = stage.body()
    val area = room.area(room.pose(at, body), body)
    val spot = Beside.place(room, area, at.wall, w.toFloat(), h.toFloat(), gap)
    // Its tail points at the mascot, from the side of the card that faces it.
    val midX = (area.left + area.right) / 2
    val midY = (area.top + area.bottom) / 2
    val side = when {
      spot.x + w <= area.left -> CardBack.Side.RIGHT
      spot.x >= area.right -> CardBack.Side.LEFT
      spot.y + h <= area.top -> CardBack.Side.BOTTOM
      else -> CardBack.Side.TOP
    }
    val across = side == CardBack.Side.LEFT || side == CardBack.Side.RIGHT
    windows.card?.tail(side, if (across) midY - spot.y else midX - spot.x)
    windows.card(spot)
  }

  private fun roomChanged(room: Room) {
    if (waitingRoom) {
      waitingRoom = false
      if (scene != null) comeIn(room)
      return
    }
    val stage = windows.stage ?: return
    val at = perch ?: return
    if (entering || leaving || dragging || binned) return
    // Turned or resized: the same wall, as far along as still fits.
    val kept = room.clamp(at, stage.body())
    perch = kept
    stage.place(room.pose(kept, stage.body()))
    settled()
  }

  private fun loadFigures(agentId: String) {
    val stage = windows.stage ?: return
    val json = MascotFigures.get(agentId)
    if (json == figuresJson && json != null) return
    figuresJson = json
    val read = FiguresJson.read(json)
    // Plain A-01 stands in when the app has not sent this agent's mascot (yet).
    if (read == null) Log.i(TAG, "no mascot for $agentId (${if (json == null) "none sent" else "unreadable"}): plain A-01")
    stage.figures = read ?: PlainFigures.FIGURES
  }

  // In a pause, you said you are done: it slides to the bottom corner and sleeps.
  private fun sleep() {
    val stage = windows.stage ?: return
    val room = stage.room ?: return
    val from = stage.pose() ?: return
    val at = perch ?: return
    val body = stage.body()
    val corner = room.corner(from, body)
    val to = room.pose(corner, body)
    perch = corner
    stage.wall = Wall.BOTTOM
    windows.grip(null)
    windows.card(null)
    val move = if (at.wall.side) {
      Chain.of(Moves.slide(from, to, Moves.msFor(Moves.distance(from, to), SLIDE_PX_PER_MS, 260, 900)), Moves.settle(to, Wall.BOTTOM.knock))
    } else {
      Fling.move(room, body, from, corner)
    }
    stage.play(move, Facing.BACK to Eyes.DOT) { settled() }
  }

  private fun press(button: Button) {
    when (button.own) {
      Own.REST -> {
        rested = true
        folded = false
        refresh()
        sleep()
        return
      }
      // Its chat in PhoneCanDo; the pause stays as it is. Already there, it says so.
      Own.OPEN_APP -> {
        val s = scene ?: return
        val here = AppOnScreen.shown && Engines.peek()?.openAgent() == s.agentId
        if (!here) LaunchTargets.open(service, LaunchTarget(LaunchTarget.HOME, s.agentId))
        windows.stage?.say(if (here) GlassCopy.IN_CHAT else GlassCopy.OPENING_CHAT)
        return
      }
      null -> {}
    }
    val act = button.act ?: return
    controls = false
    main.removeCallbacks(closeControls)
    refresh()
    // Off the main thread: the store's notices may write the message log.
    thread(name = "phonecando-presence-act") { Presence.user(act) }
  }

  override fun tap() {
    val s = scene ?: return
    if (entering || leaving || binned) return
    if (s.act == Act.DRIVING) {
      controls = !controls
      main.removeCallbacks(closeControls)
      if (controls) main.postDelayed(closeControls, CONTROLS_MS)
    } else {
      folded = !folded
    }
    refresh()
  }

  override fun drag(x: Float, y: Float) {
    val stage = windows.stage ?: return
    if (entering || leaving || binned) return
    val dp = service.resources.displayMetrics.density
    if (!dragging) {
      dragging = true
      controls = false
      windows.card(null)
      if (scene?.droppable == true) stage.room?.let { stage.bin = Bin.spot(it, dp) }
    }
    val body = stage.body()
    stage.hold(Pose(x, y + body.h / 2, sx = 0.94f, sy = 1.08f, toward = stage.pose()?.toward ?: 1))
    windows.gripAt(Pt(x, y))
    val spot = stage.bin ?: return
    val over = Bin.over(spot, Pt(x, y), dp)
    if (over == stage.binArmed) return
    stage.binArmed = over
    if (over) windows.grip?.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
  }

  override fun letGo(x: Float, y: Float, vx: Float, vy: Float) {
    val stage = windows.stage ?: return
    val room = stage.room ?: return
    if (!dragging) return
    dragging = false
    val spot = stage.bin
    if (spot != null && stage.binArmed) {
      drop(spot)
      return
    }
    stage.bin = null
    stage.binArmed = false
    val body = stage.body()
    val from = stage.pose() ?: return
    val landing = Fling.land(room, body, Pt(x, y), Pt(vx, vy))
    perch = landing
    remembered = landing
    stage.wall = landing.wall
    stage.play(Fling.move(room, body, from, landing), Facing.FRONT to Eyes.WIDE) { settled() }
    refresh()
  }

  // Let go over the bin: it drops in and the agent is left stopped (Leave
  // it); the scene ending then takes the glass away (leave).
  private fun drop(spot: BinSpot) {
    val stage = windows.stage ?: return
    val from = stage.pose() ?: return
    binned = true
    windows.grip(null)
    windows.card(null)
    stage.play(Bin.drop(from, spot), Facing.FRONT to Eyes.SHUT) {
      dropped = true
      if (leaving) {
        leaving = false
        gone()
      }
    }
    // Off the main thread: the store's notices may write the message log.
    thread(name = "phonecando-presence-act") {
      if (!Presence.user(UserAct.LEAVE)) main.post { unbin() }
    }
  }

  // Leave it no longer applied (the pause ended meanwhile): it comes back out to its wall.
  private fun unbin() {
    if (!binned || leaving) return
    val stage = windows.stage ?: return
    val room = stage.room ?: return
    val at = perch ?: return
    val from = stage.pose() ?: return
    binned = false
    dropped = false
    stage.bin = null
    stage.binArmed = false
    stage.play(Fling.move(room, stage.body(), from, at), Facing.FRONT to Eyes.WIDE) { settled() }
    refresh()
  }

  // A touch of yours somewhere while the agent drives: you took the phone,
  // so it watches (Let me). Not the agent's own touches (none come through
  // while the glass lets them through, nor just after), nor yours on the
  // mascot or its card.
  private fun youTouched(x: Float, y: Float) {
    val s = scene ?: return
    if (s.act != Act.DRIVING || leaving || dragging || takingOver || throughs > 0) return
    if (SystemClock.uptimeMillis() - agentTouchedAt < AGENT_TOUCH_GRACE_MS) return
    if (windows.ours(x, y)) return
    takingOver = true
    windows.stage?.say(GlassCopy.YOU_TOOK_IT)
    thread(name = "phonecando-presence-act") {
      Presence.user(UserAct.LET_ME)
      main.post { takingOver = false }
    }
  }

  // The agent is about to touch along [path]: it looks there and moves along its wall out of the way.
  private fun aim(path: List<Pt>) {
    if (path.isEmpty() || scene?.act != Act.DRIVING) return
    if (entering || leaving || dragging) return
    val stage = windows.stage ?: return
    val room = stage.room ?: return
    val at = perch ?: return
    stage.look(path.first())
    val body = stage.body()
    val next = Dodge.follow(room, body, at, path)
    if (next.wall == at.wall && abs(next.along - at.along) < body.h * FOLLOW_SHARE) return
    val from = stage.pose() ?: return
    val to = room.pose(next, body)
    perch = next
    stage.wall = next.wall
    val move = if (next.wall == at.wall) {
      Chain.of(Moves.slide(from, to, Moves.msFor(Moves.distance(from, to), SLIDE_PX_PER_MS, 140, 360)), Moves.settle(to, next.wall.knock, strength = 0.12f))
    } else {
      Fling.move(room, body, from, next)
    }
    stage.play(move) { settled() }
  }

  override suspend fun <T> hidden(block: suspend () -> T): T {
    val views = withContext(Dispatchers.Main) {
      hides++
      windows.views().onEach {
        it.animate().cancel()
        it.alpha = 0f
      }
    }
    try {
      FrameWait.drawn(views)
      return block()
    } finally {
      withContext(NonCancellable + Dispatchers.Main) {
        if (--hides == 0) windows.views().forEach { it.alpha = 1f }
      }
    }
  }

  override suspend fun <T> touchThrough(path: List<Pt>, block: suspend () -> T): T {
    val views: List<View> = withContext(Dispatchers.Main) {
      throughs++
      aim(path)
      windows.touchable(false)
    }
    try {
      FrameWait.drawn(views)
      return block()
    } finally {
      withContext(NonCancellable + Dispatchers.Main) {
        agentTouchedAt = SystemClock.uptimeMillis()
        if (--throughs == 0) windows.touchable(true)
      }
    }
  }

  private companion object {
    const val TAG = "PhoneCanDoGlass"
    const val CONTROLS_MS = 6_000L

    /** After the agent's touch, how long a touch still counts as its own (the gesture's last events). */
    const val AGENT_TOUCH_GRACE_MS = 600L
    const val CARD_GAP_DP = 8f
    const val SLIDE_PX_PER_MS = 1.6f

    /** A touch this share of its height along from where it stands, it stays put. */
    const val FOLLOW_SHARE = 0.15f
  }
}
