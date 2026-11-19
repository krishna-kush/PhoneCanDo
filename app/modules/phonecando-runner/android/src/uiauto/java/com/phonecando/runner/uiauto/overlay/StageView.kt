package com.phonecando.runner.uiauto.overlay

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.os.Build
import android.os.SystemClock
import android.util.TypedValue
import android.view.RoundedCorner
import android.view.View
import android.view.WindowInsets
import com.phonecando.runner.R
import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.figure.Figures
import com.phonecando.runner.presence.glass.figure.PlainFigures
import com.phonecando.runner.presence.glass.motion.Idle
import com.phonecando.runner.presence.glass.motion.Move
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt
import com.phonecando.runner.presence.glass.scene.Glow
import com.phonecando.runner.presence.glass.scene.Show
import com.phonecando.runner.presence.glass.walls.Body
import com.phonecando.runner.presence.glass.walls.Room
import com.phonecando.runner.presence.glass.walls.Wall
import kotlin.math.sin

// The glass's one drawing surface, the whole screen in a window that never
// takes a touch: the edge's glow, the mascot where its move has it, its
// line when it hangs from one, its speech bubble, thinking dots and the
// z's of its sleep. It runs the moves GlassOverlay gives it frame by frame
// (presence/glass/motion, pure) and adds the life of its own: blinks, eyes
// that wander or follow the agent's touch, breathing.
internal class StageView(context: Context, private val palette: Palette) : View(context) {
  private val dp = resources.displayMetrics.density
  private val mascot = MascotPainter(palette)
  private val glow = EdgeGlow(dp)
  private val bubble = BubblePainter(
    palette,
    dp,
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 1f, resources.displayMetrics),
    runCatching { resources.getFont(R.font.geist_mono_regular) }.getOrNull(),
  )
  private val thread = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 1.5f * dp
    color = palette.fg
  }
  private val zee = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = palette.fg
    isFakeBoldText = true
  }
  private val born = SystemClock.uptimeMillis()
  private val ticking = Runnable { tick() }

  /** Pixels per figure unit: a figure is laid out at size 100. */
  val scale = BLOCK_DP * dp / 100f

  /** Told when the screen's size or bars change, so the mascot keeps to its wall. */
  var onRoom: ((Room) -> Unit)? = null

  var room: Room? = null
    private set

  var figures: Figures = PlainFigures.FIGURES

  var show: Show? = null

  /** The wall it rests on, for where the bubble goes. */
  var wall: Wall = Wall.RIGHT

  private var rest: Pose? = null
  private var move: Move? = null
  private var moveAt = 0L
  private var moveLook: Pair<Facing, Eyes>? = null
  private var moveDone: (() -> Unit)? = null
  private var held: Pose? = null
  private var lookAt: Pt? = null
  private var lookUntil = 0L
  private var said: String? = null
  private var saidUntil = 0L

  /** The mascot's box, upright, in pixels. */
  fun body(): Body {
    val reach = figures.reach
    return Body(reach.w * scale, -reach.y * scale, GAP_DP * dp)
  }

  /** Where it is drawn now. */
  fun pose(): Pose? = held ?: move?.at(SystemClock.uptimeMillis() - moveAt) ?: rest

  val moving: Boolean get() = move != null

  /**
   * Runs [next] from now; [look] is how it looks while it moves (null: as
   * the show has it, bubble and all); [done] after its end. A move cut
   * short by another never calls its own [done].
   */
  fun play(next: Move, look: Pair<Facing, Eyes>? = null, done: (() -> Unit)? = null) {
    held = null
    move = next
    moveAt = SystemClock.uptimeMillis()
    moveLook = look
    rest = next.end
    moveDone = done
    invalidate()
  }

  /** Stands it at [pose] at once. */
  fun place(pose: Pose) {
    move = null
    moveDone = null
    held = null
    rest = pose
    invalidate()
  }

  /** In your hand: drawn at [pose] until a move or place lets go. */
  fun hold(pose: Pose) {
    move = null
    moveDone = null
    held = pose
    invalidate()
  }

  /** Its eyes go to [p] for a moment (the agent's touch). */
  fun look(p: Pt) {
    lookAt = p
    lookUntil = SystemClock.uptimeMillis() + LOOK_MS
  }

  /** It says [words] in its bubble for a moment, over its status (what a button of yours did). */
  fun say(words: String) {
    said = words
    saidUntil = SystemClock.uptimeMillis() + SAY_MS
    invalidate()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    postOnAnimation(ticking)
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(ticking)
    super.onDetachedFromWindow()
  }

  override fun onApplyWindowInsets(insets: WindowInsets): WindowInsets {
    measureRoom(width, height, insets)
    return super.onApplyWindowInsets(insets)
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    measureRoom(w, h, rootWindowInsets)
  }

  private fun measureRoom(w: Int, h: Int, insets: WindowInsets?) {
    if (w <= 0 || h <= 0) return
    val next = if (insets == null) {
      Room(w.toFloat(), h.toFloat())
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      Room(w.toFloat(), h.toFloat(), bars.left.toFloat(), bars.top.toFloat(), bars.right.toFloat(), bars.bottom.toFloat())
    } else {
      @Suppress("DEPRECATION")
      Room(
        w.toFloat(),
        h.toFloat(),
        insets.systemWindowInsetLeft.toFloat(),
        insets.systemWindowInsetTop.toFloat(),
        insets.systemWindowInsetRight.toFloat(),
        insets.systemWindowInsetBottom.toFloat(),
      )
    }
    if (next == room) return
    room = next
    onRoom?.invoke(next)
  }

  private fun tick() {
    val m = move
    if (m != null && SystemClock.uptimeMillis() - moveAt >= m.ms) {
      move = null
      moveLook = null
      val done = moveDone
      moveDone = null
      done?.invoke()
    }
    invalidate()
    postOnAnimation(ticking)
  }

  override fun onDraw(canvas: Canvas) {
    // Read as it draws: the theme can change while the glass is up.
    thread.color = palette.fg
    zee.color = palette.fg
    val now = SystemClock.uptimeMillis()
    val t = now - born
    val show = show
    val room = room ?: return
    if (show != null && show.glow != Glow.OFF) {
      val color = if (show.glow == Glow.RED) palette.primary else palette.secondary
      glow.draw(canvas, width, height, color, Idle.glow(t), corner())
    }
    val pose = pose() ?: return
    val base = when {
      held != null -> Facing.FRONT to Eyes.WIDE
      moveLook != null -> moveLook!!
      show != null -> show.facing to show.eyes
      else -> Facing.SIDE to Eyes.DOT
    }
    // A move that acts with its face (the entrance's peek) says how it looks frame by frame.
    val look = (pose.facing ?: base.first) to (pose.eyes ?: base.second)
    val figure = figures.pose(look.first, look.second)
    val (bx, by) = if (move == null && held == null) Idle.breathe(t, show?.asleep == true) else 1f to 1f
    val drawn = pose.squashed(bx, by)
    pose.thread?.let { tie ->
      val crown = drawn.crown(-figure.front.y * scale)
      canvas.drawLine(tie.x, tie.y, crown.x, crown.y, thread)
    }
    val shut = pose.shut ?: if (look.second == Eyes.SHUT || held != null) 0f else Idle.blink(t)
    mascot.draw(canvas, figure, drawn, scale, shut, pose.gaze ?: gaze(drawn, now, t))
    if (show?.asleep == true && move == null) zs(canvas, drawn, t)
    if (held != null || moveLook != null) return
    val area = room.area(pose, body())
    val words = said?.takeIf { now < saidUntil }
    if (words != null) {
      bubble.draw(canvas, room, area, wall, words, dots = false, BubblePainter.Voice.SAY, now)
    } else {
      bubble.draw(canvas, room, area, wall, show?.bubble, dots = show?.thinking == true, BubblePainter.Voice.STATUS, now)
    }
  }

  // Toward the agent's last touch for a moment, otherwise wandering; face on, mostly at you.
  private fun gaze(pose: Pose, now: Long, t: Long): Pt {
    val target = lookAt
    if (target != null && now < lookUntil) {
      val from = Pt(pose.x, pose.y - body().h / 2)
      return Idle.lookAt(from, target, 160 * dp)
    }
    val w = Idle.wander(t)
    return if (show?.facing == Facing.FRONT) Pt(w.x * 0.4f, w.y * 0.4f) else w
  }

  private fun zs(canvas: Canvas, pose: Pose, t: Long) {
    val crown = pose.crown(body().h)
    for ((i, z) in Idle.zs(t).withIndex()) {
      val (up, size) = z
      zee.textSize = (8 + 8 * size) * dp
      zee.alpha = ((1 - up) * 255).toInt()
      val drift = sin((t / 600f) + i) * 4 * dp
      val side = if (pose.x < (room?.w ?: 0f) / 2) 1 else -1
      canvas.drawText("z", crown.x + side * (10 * dp + up * 14 * dp) + drift, crown.y - up * 34 * dp, zee)
    }
  }

  private fun corner(): Float {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return 0f
    return rootWindowInsets?.getRoundedCorner(RoundedCorner.POSITION_TOP_LEFT)?.radius?.toFloat() ?: 0f
  }

  companion object {
    /** A figure block's short side on the glass. */
    const val BLOCK_DP = 42f
    const val GAP_DP = 6f
    const val LOOK_MS = 1_500L
    const val SAY_MS = 2_500L
  }
}
