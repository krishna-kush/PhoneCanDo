package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.manifest.ManifestException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * A kind's one-shot mode, `one-shot.json` beside its agent.json: the [argv]
 * that answers one prompt (the item that is exactly [PROMPT]) and exits,
 * and [env] on top of the kind's launch env. Only CI's local-model check
 * reads it (render-model); nothing packages it. The kit's TS validator
 * (kit/ts/manifest/one-shot.ts) holds the full rules; this reads the shape.
 */
data class OneShot(val argv: List<String>, val env: Map<String, String>) {
  /** Where the prompt goes in [argv]. */
  val promptAt: Int get() = argv.indexOf(PROMPT)

  companion object {
    const val FILE = "one-shot.json"
    const val PROMPT = "{{prompt}}"
    private val FIELDS = setOf("argv", "env")

    /** Throws ManifestException naming the JSON pointer of what is wrong. */
    fun decode(text: String): OneShot {
      val root = try {
        Json.parseToJsonElement(text)
      } catch (e: SerializationException) {
        throw ManifestException("", "not JSON: ${e.message}")
      }
      val obj = root as? JsonObject ?: throw ManifestException("", "must be an object")
      obj.keys.firstOrNull { it !in FIELDS }?.let { throw ManifestException("/$it", "unknown field") }
      val argv = (obj["argv"] as? JsonArray ?: throw ManifestException("/argv", "must be an array of strings"))
        .mapIndexed { i, item -> text("/argv/$i", item) }
      if (argv.size < 2) throw ManifestException("/argv", "names the program and its prompt at least")
      val prompts = argv.indices.filter { argv[it] == PROMPT }
      if (prompts.size != 1 || prompts[0] == 0) {
        throw ManifestException("/argv", "holds $PROMPT as exactly one item, after the program")
      }
      val env = when (val e = obj["env"]) {
        null -> emptyMap()
        is JsonObject -> e.mapValuesTo(LinkedHashMap()) { (name, value) -> text("/env/$name", value) }
        else -> throw ManifestException("/env", "must be an object of strings")
      }
      return OneShot(argv, env)
    }

    private fun text(path: String, value: JsonElement): String =
      (value as? JsonPrimitive)?.takeIf { it.isString }?.content ?: throw ManifestException(path, "must be a string")
  }
}
