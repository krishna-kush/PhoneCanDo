package com.phonecando.runner.presence.glass

import com.phonecando.runner.presence.glass.figure.Box
import com.phonecando.runner.presence.glass.figure.Drawn
import com.phonecando.runner.presence.glass.figure.Eyes
import com.phonecando.runner.presence.glass.figure.Facing
import com.phonecando.runner.presence.glass.figure.Figure
import com.phonecando.runner.presence.glass.figure.FiguresJson
import com.phonecando.runner.presence.glass.figure.Ink
import com.phonecando.runner.presence.glass.figure.PlainFigures
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// The figures JSON as the app sends it (fixtures made by mascot/layout's
// figure() at size 100) reads back whole, and plain A-01 laid out here
// matches mascot/'s own numbers.
class FiguresTest {
  private fun fixture(name: String) = javaClass.getResource("/com/phonecando/runner/presence/glass/$name.json")!!.readText()

  @Test
  fun readsEveryPoseAndMarkKind() {
    val coder = FiguresJson.read(fixture("coder"))!!
    assertEquals(Eyes.entries.toSet(), coder.front.keys)
    assertEquals(setOf(Eyes.DOT, Eyes.SHUT), coder.side.keys)
    assertEquals(2, coder.front.getValue(Eyes.DOT).eyes.size)
    assertEquals(1, coder.side.getValue(Eyes.DOT).eyes.size)
    assertTrue(coder.back.eyes.isEmpty())
    val marks = coder.front.getValue(Eyes.DOT).marks
    assertTrue(marks.any { it is Drawn.Rect && it.paint.stroke == Ink.DARK && it.paint.fill == null })
    assertTrue((coder.front.values + coder.side.values).flatMap { it.marks }.any { it is Drawn.Line })
    assertTrue(marks.any { it is Drawn.Poly })

    val dj = FiguresJson.read(fixture("dj"))!!
    val arc = dj.front.getValue(Eyes.DOT).marks.filterIsInstance<Drawn.Arc>().first()
    assertEquals(180f, arc.from, 0f)
    assertEquals(360f, arc.to, 0f)
    assertEquals(55f, arc.rx, 0f)
    // A tall hat reaches far above the block.
    assertTrue(dj.reach.y < -200f)
  }

  @Test
  fun shutEyesHaveNoPupils() {
    val coder = FiguresJson.read(fixture("coder"))!!
    assertTrue(coder.front.getValue(Eyes.SHUT).eyes.all { it.pupil == null })
    assertTrue(coder.front.getValue(Eyes.DOT).eyes.all { it.pupil != null })
  }

  @Test
  fun anythingUnreadableIsNull() {
    assertNull(FiguresJson.read(null))
    assertNull(FiguresJson.read(""))
    assertNull(FiguresJson.read("{not json"))
    assertNull(FiguresJson.read(fixture("plain").replace("\"v\":1", "\"v\":2")))
    assertNull(FiguresJson.read("""{"v":1,"poses":{"front":{},"side":{},"back":{}}}"""))
  }

  @Test
  fun aMissingLookFallsBackToOpenEyes() {
    val plain = FiguresJson.read(fixture("plain"))!!
    assertEquals(plain.side.getValue(Eyes.DOT), plain.pose(Facing.SIDE, Eyes.WIDE))
  }

  @Test
  fun plainA01MatchesTheSpec() {
    val spec = FiguresJson.read(fixture("plain"))!!
    val ours = PlainFigures.FIGURES
    for (eyes in Eyes.entries) same(spec.front.getValue(eyes), ours.front.getValue(eyes), "front $eyes")
    for (eyes in listOf(Eyes.DOT, Eyes.SHUT)) same(spec.side.getValue(eyes), ours.side.getValue(eyes), "side $eyes")
    same(spec.back, ours.back, "back")
  }

  private fun same(a: Figure, b: Figure, what: String) {
    box(a.front, b.front, "$what front")
    box(a.back, b.back, "$what back")
    assertEquals("$what inks", a.frontInk to a.backInk, b.frontInk to b.backInk)
    box(a.bounds, b.bounds, "$what bounds")
    assertEquals("$what eyes", a.eyes.size, b.eyes.size)
    a.eyes.zip(b.eyes).forEach { (x, y) ->
      box(x.open, y.open, "$what open")
      box(x.lid, y.lid, "$what lid")
      assertEquals("$what pupil", x.pupil == null, y.pupil == null)
      if (x.pupil != null) box(x.pupil!!, y.pupil!!, "$what pupil")
    }
    assertEquals("$what marks", a.marks.size, b.marks.size)
    a.marks.zip(b.marks).forEach { (x, y) ->
      val rx = x as Drawn.Rect
      val ry = y as Drawn.Rect
      box(rx.box, ry.box, "$what vent")
      assertEquals(rx.paint, ry.paint)
    }
  }

  private fun box(a: Box, b: Box, what: String) {
    assertNotNull(b)
    assertEquals("$what x", a.x, b.x, 0.01f)
    assertEquals("$what y", a.y, b.y, 0.01f)
    assertEquals("$what w", a.w, b.w, 0.01f)
    assertEquals("$what h", a.h, b.h, 0.01f)
  }
}
