package com.phonecando.runner.presence.glass.figure

import org.json.JSONArray
import org.json.JSONObject

// The app's figures JSON (app/src/engine/presence/figures.ts) read into
// Figures: { v: 1, shape, poses: { front: {dot, wide, sleepy, shut, happy},
// side: {dot, shut}, back } }. Anything it can't read gives null, and the
// glass draws plain A-01 instead (PlainFigures) rather than nothing.
object FiguresJson {
  fun read(json: String?): Figures? {
    if (json.isNullOrBlank()) return null
    return try {
      val root = JSONObject(json)
      if (root.optInt("v") != 1) return null
      val poses = root.getJSONObject("poses")
      val front = looks(poses.getJSONObject("front"))
      val side = looks(poses.getJSONObject("side"))
      if (Eyes.DOT !in front || Eyes.DOT !in side) return null
      Figures(front, side, figure(poses.getJSONObject("back")))
    } catch (e: Exception) {
      null
    }
  }

  private fun looks(o: JSONObject): Map<Eyes, Figure> =
    Eyes.entries.mapNotNull { eyes -> o.optJSONObject(eyes.name.lowercase())?.let { eyes to figure(it) } }.toMap()

  private fun figure(o: JSONObject): Figure {
    val front = o.getJSONObject("front")
    val back = o.getJSONObject("back")
    return Figure(
      front = box(front),
      frontInk = ink(front.getString("ink"))!!,
      back = box(back),
      backInk = ink(back.getString("ink"))!!,
      eyes = list(o.getJSONArray("eyes")) { eye(it) },
      marks = list(o.getJSONArray("marks")) { mark(it) },
      bounds = box(o.getJSONObject("bounds")),
    )
  }

  private fun eye(o: JSONObject) = Eye(
    open = box(o.getJSONObject("open")),
    lid = box(o.getJSONObject("lid")),
    pupil = o.optJSONObject("pupil")?.let(::box),
  )

  private fun mark(o: JSONObject): Drawn {
    val paint = Painted(
      fill = ink(o.optString("fill")),
      stroke = ink(o.optString("stroke")),
      width = o.optDouble("width", 0.0).toFloat(),
      alpha = o.optDouble("alpha", 1.0).toFloat(),
    )
    return when (val kind = o.getString("kind")) {
      "rect" -> Drawn.Rect(box(o), paint)
      "poly" -> Drawn.Poly(points(o.getJSONArray("points")), paint)
      "arc" -> Drawn.Arc(f(o, "x"), f(o, "y"), f(o, "rx"), f(o, "ry"), f(o, "from"), f(o, "to"), paint)
      "line" -> points(o.getJSONArray("points")).let { Drawn.Line(it[0], it[1], paint) }
      else -> throw IllegalArgumentException("mark kind $kind")
    }
  }

  private fun points(a: JSONArray): List<Pair<Float, Float>> =
    (0 until a.length()).map { i -> a.getJSONArray(i).let { it.getDouble(0).toFloat() to it.getDouble(1).toFloat() } }

  private fun box(o: JSONObject) = Box(f(o, "x"), f(o, "y"), f(o, "w"), f(o, "h"))

  private fun f(o: JSONObject, key: String) = o.getDouble(key).toFloat()

  private fun ink(name: String?): Ink? = when (name) {
    "wear" -> Ink.WEAR
    "red" -> Ink.RED
    "amber" -> Ink.AMBER
    "eye" -> Ink.EYE
    "dark" -> Ink.DARK
    else -> null
  }

  private fun <T> list(a: JSONArray, read: (JSONObject) -> T): List<T> = (0 until a.length()).map { read(a.getJSONObject(it)) }
}
