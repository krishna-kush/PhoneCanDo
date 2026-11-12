package com.phonecando.runner.engine.image

import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import java.io.File

// The part of an image the engine host knows (lre ImageLayout, read here
// directly so this module never depends on lre): `<filesDir>/images/<id>/`
// with home/, tmp/, logs/ and run/engine.env, plus the optional
// run/os-note.md. The Linux module creates and fills it; we only read, and
// write each engine's log into logs/ (one per agent: a machine may run
// several).
class ImageDir(val root: File) {
  val home: File get() = File(root, "home")
  val tmp: File get() = File(root, "tmp")
  val logs: File get() = File(root, "logs")
  val engineEnv: File get() = File(File(root, "run"), "engine.env")
  val osNote: File get() = File(File(root, "run"), "os-note.md")

  /** A server engine's stdout and stderr (ServerSpawner); read back for telemetry's log tail. */
  fun engineLog(agentId: String) = File(logs, "engine-$agentId.log")

  /**
   * The engine's environment for this image (engine.env), with HOME and
   * TMPDIR always set. Throws image_not_ready while the file is missing:
   * the image is still being made, or its setup failed.
   */
  fun readEnv(): Map<String, String> {
    val text = try {
      engineEnv.readText(Charsets.UTF_8)
    } catch (_: Exception) {
      throw EngineStartException(EngineStartError.IMAGE_NOT_READY, "the image has no engine.env yet")
    }
    val env = LinkedHashMap(EngineEnvFile.parse(text))
    env.putIfAbsent("HOME", home.path)
    env.putIfAbsent("TMPDIR", tmp.path)
    return env
  }

  companion object {
    fun of(filesDir: File, imageId: String) = ImageDir(File(File(filesDir, "images"), imageId))
  }
}

// engine.env: one KEY=VALUE per line, no quotes, no expansion. Blank lines
// and lines without a valid name before the first '=' are skipped; a later
// line wins over an earlier one. Pure.
object EngineEnvFile {
  private val NAME = Regex("[A-Za-z_][A-Za-z0-9_]*")

  fun parse(text: String): Map<String, String> {
    val out = LinkedHashMap<String, String>()
    for (raw in text.split('\n')) {
      val line = raw.removeSuffix("\r")
      val eq = line.indexOf('=')
      if (eq <= 0) continue
      val key = line.substring(0, eq)
      if (!NAME.matches(key)) continue
      out[key] = line.substring(eq + 1)
    }
    return out
  }
}
