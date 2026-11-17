package com.phonecando.agents.cline

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File

// The model Cline's own TUI last used: providers.json's `lastUsedProvider`
// and that provider's `settings.model`. Cline's ACP mode never reads it
// (it takes the provider's default model, or CLINE_MODEL only when its
// chat-model list has it, which leaves out the free `cline-free/*` ones:
// apps/cli/src/acp/acpAgent.ts, cli-v3.0.74), so the runner sets it on
// each ACP chat as the `model` config option. The file also holds sign-in
// tokens: only these two fields are read, and nothing of it is logged.
internal object ChosenModel {
  /** Under the agent's HOME. */
  const val PROVIDERS = ".cline/data/settings/providers.json"

  /** Cline's ACP session config option for the model. */
  const val OPTION = "model"

  // A plain id, as the ACP script checked before ("cline-free/solar-mini4").
  private val PLAIN = Regex("""^[\w.:/@-]+$""")
  private const val MAX_ID = 256
  private const val MAX_FILE_BYTES = 1L shl 20

  /** `{"model": <id>}`, or empty: no file, no provider or model, or not a plain id. */
  fun options(home: File): Map<String, String> = read(File(home, PROVIDERS))?.let { mapOf(OPTION to it) }.orEmpty()

  private fun read(file: File): String? = try {
    if (!file.isFile || file.length() > MAX_FILE_BYTES) {
      null
    } else {
      val root = Json.parseToJsonElement(file.readText()) as? JsonObject
      val provider = root?.text("lastUsedProvider")
      val providers = root?.get("providers") as? JsonObject
      val settings = (provider?.let { providers?.get(it) } as? JsonObject)?.get("settings") as? JsonObject
      settings?.text("model")?.takeIf { it.length <= MAX_ID && PLAIN.matches(it) }
    }
  } catch (_: Exception) {
    // Unreadable or not JSON: no option, and no word of the file's contents.
    null
  }

  private fun JsonObject.text(key: String): String? = (get(key) as? JsonPrimitive)?.takeIf { it.isString }?.content
}
