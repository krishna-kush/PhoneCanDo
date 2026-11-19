package com.phonecando.runner.uiauto.overlay

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.phonecando.runner.presence.glass.figure.Box
import com.phonecando.runner.presence.glass.figure.Drawn
import com.phonecando.runner.presence.glass.figure.Figure
import com.phonecando.runner.presence.glass.figure.Ink
import com.phonecando.runner.presence.glass.motion.Pose
import com.phonecando.runner.presence.glass.motion.Pt

// Draws one of the mascot's figures (presence/glass/figure) where a pose
// puts it, as the site's backdrop does (web/src/lib/backdrop/paint/unit.ts
// drawUnit and drawMark): its two blocks, its eyes, then what it wears.
// The figure is in its own units from its feet; [scale] turns them into
// pixels. The lids come down for a blink ([shut], 0 to 1) and the pupils
// move inside the open eye ([gaze], -1 to 1 each way, screen directions).
internal class MascotPainter(private val palette: Palette) {
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
  private val path = Path()
  private val oval = RectF()
  private val clip = RectF()

  fun draw(canvas: Canvas, figure: Figure, pose: Pose, scale: Float, shut: Float, gaze: Pt) {
    val hanging = pose.rot > 90f || pose.rot < -90f
    // The figures face right; turned the other way on screen, or hanging upside down facing right, it is mirrored.
    val mirror = (if (hanging) -pose.toward else pose.toward) < 0
    // The screen's directions as the figure has them once turned and mirrored.
    val gx = gaze.x * (if (mirror) -1 else 1) * (if (hanging) -1 else 1)
    val gy = gaze.y * (if (hanging) -1 else 1)
    canvas.save()
    canvas.translate(pose.x, pose.y)
    canvas.rotate(pose.rot)
    canvas.scale(pose.sx * scale * (if (mirror) -1 else 1), pose.sy * scale)
    rect(canvas, figure.back, color(figure.backInk), 255)
    rect(canvas, figure.front, color(figure.frontInk), 255)
    for (eye in figure.eyes) {
      val lid = eye.lid
      val top = lid.y + lid.h * SHUT_SHARE * shut
      val h = lid.h * (1 - SHUT_SHARE * shut)
      fill.color = palette.onPrimary
      canvas.drawRect(lid.x, top, lid.right, top + h, fill)
      val pupil = eye.pupil ?: continue
      if (h < eye.open.h * 0.3f) continue
      val px = (pupil.x + gx * eye.open.w * 0.22f).coerceIn(eye.open.x, eye.open.right - pupil.w)
      val py = pupil.y + gy * h * 0.16f
      canvas.save()
      clip.set(lid.x, top, lid.right, top + h)
      canvas.clipRect(clip)
      fill.color = palette.darkBg
      canvas.drawRect(px, py, px + pupil.w, py + pupil.h, fill)
      canvas.restore()
    }
    for (mark in figure.marks) mark(canvas, mark, scale)
    canvas.restore()
  }

  private fun mark(canvas: Canvas, d: Drawn, scale: Float) {
    val alpha = (d.paint.alpha.coerceIn(0f, 1f) * 255).toInt()
    if (alpha <= 2) return
    val fillInk = d.paint.fill
    val strokeInk = d.paint.stroke
    // At least a pixel wide, as the site draws it.
    line.strokeWidth = maxOf(d.paint.width, 1f / scale)
    when (d) {
      is Drawn.Rect -> {
        if (fillInk != null) rect(canvas, d.box, color(fillInk), alpha)
        if (strokeInk != null) {
          paintLine(strokeInk, alpha)
          canvas.drawRect(d.box.x, d.box.y, d.box.right, d.box.bottom, line)
        }
      }
      is Drawn.Poly -> {
        path.reset()
        d.points.forEachIndexed { i, (x, y) -> if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }
        path.close()
        shape(canvas, fillInk, strokeInk, alpha)
      }
      is Drawn.Arc -> {
        path.reset()
        oval.set(d.x - d.rx, d.y - d.ry, d.x + d.rx, d.y + d.ry)
        var sweep = d.to - d.from
        if (sweep < 0) sweep += 360f
        path.addArc(oval, d.from, sweep)
        shape(canvas, fillInk, strokeInk, alpha)
      }
      is Drawn.Line -> if (strokeInk != null) {
        paintLine(strokeInk, alpha)
        canvas.drawLine(d.a.first, d.a.second, d.b.first, d.b.second, line)
      }
    }
  }

  private fun shape(canvas: Canvas, fillInk: Ink?, strokeInk: Ink?, alpha: Int) {
    if (fillInk != null) {
      fill.color = color(fillInk)
      fill.alpha = alpha
      canvas.drawPath(path, fill)
      fill.alpha = 255
    }
    if (strokeInk != null) {
      paintLine(strokeInk, alpha)
      canvas.drawPath(path, line)
    }
  }

  private fun rect(canvas: Canvas, box: Box, color: Int, alpha: Int) {
    fill.color = color
    fill.alpha = alpha
    canvas.drawRect(box.x, box.y, box.right, box.bottom, fill)
    fill.alpha = 255
  }

  private fun paintLine(ink: Ink, alpha: Int) {
    line.color = color(ink)
    line.alpha = alpha
  }

  private fun color(ink: Ink) = when (ink) {
    Ink.WEAR -> palette.fg
    Ink.RED -> palette.primary
    Ink.AMBER -> palette.secondary
    Ink.EYE -> palette.onPrimary
    Ink.DARK -> palette.darkBg
  }

  private companion object {
    // How much of the eye a blink hides.
    const val SHUT_SHARE = 0.85f
  }
}
