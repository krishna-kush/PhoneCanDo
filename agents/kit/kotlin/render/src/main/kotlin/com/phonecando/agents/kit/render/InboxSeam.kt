package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.InboxRequest
import com.phonecando.agents.kit.manifest.Auth
import com.phonecando.agents.kit.manifest.InboxEndpoint
import com.phonecando.agents.kit.manifest.InboxFormat
import com.phonecando.agents.kit.manifest.InboxHook
import com.phonecando.agents.kit.manifest.InboxLookup
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// Other agents' messages into a running agent, as the manifest's `inbox`
// says: what `phonecando-inbox <Event>` prints for a hook event, and the
// requests a server engine takes. {{messages}} is the text the runner
// rendered. In a format json string template it goes in as a JSON string's
// content (escaped); an object template is serialised after its strings are
// filled, which escapes them. A server call's path takes {{sessionId}} (the
// chat) as a URI component, and its body's strings take {{messages}} and
// {{sessionId}}; every call carries the kind's auth, as its health probe does.
object InboxSeam {
  const val MESSAGES = "messages"
  const val SESSION = "sessionId"

  /** What a hook template may name. */
  val HOOK_PLACEHOLDERS = setOf(MESSAGES)

  /** What a server call's path may name. */
  val PATH_PLACEHOLDERS = setOf(SESSION)

  /** What a server call's body may name. */
  val BODY_PLACEHOLDERS = setOf(MESSAGES, SESSION)

  /** What a hook event prints, [messages] filled in. */
  fun hook(hook: InboxHook, messages: String): String {
    val values = mapOf(MESSAGES to messages)
    val template = hook.template
    if (template is JsonObject) return fill(template, values).toString()
    val text = (template as JsonPrimitive).content
    if (hook.format == InboxFormat.TEXT) return Templates.render(text, values)
    return Templates.render(text, values, ::jsonContent)
  }

  /** The call to [endpoint]; null when it names the chat and [sessionId] is blank (there is none to post to). */
  fun request(
    endpoint: InboxEndpoint,
    auth: Auth?,
    port: String,
    password: String,
    sessionId: String,
    messages: String,
  ): InboxRequest? {
    if (sessionId.isBlank() && namesSession(endpoint)) return null
    val values = mapOf(MESSAGES to messages, SESSION to sessionId)
    val url = EngineUrl.base(port) + Templates.render(endpoint.path, values, Templates::uriComponent)
    val headers = linkedMapOf("Content-Type" to "application/json") + SecretForms.headers(auth, password)
    return InboxRequest(url, headers, endpoint.method, fill(endpoint.body, values).toString())
  }

  /** The GET for the agent's newest chat (`inbox.server.latest`), with the kind's auth. */
  fun latest(lookup: InboxLookup, auth: Auth?, port: String, password: String): InboxRequest =
    InboxRequest(EngineUrl.base(port) + lookup.path, SecretForms.headers(auth, password), "GET", "")

  /** Every string in [element] (an object's values, not its keys), depth first. */
  fun strings(element: JsonElement): List<String> = when (element) {
    is JsonObject -> element.values.flatMap(::strings)
    is JsonArray -> element.flatMap(::strings)
    is JsonPrimitive -> if (element.isString) listOf(element.content) else emptyList()
  }

  private fun namesSession(endpoint: InboxEndpoint) =
    (listOf(endpoint.path) + strings(endpoint.body)).any { SESSION in Templates.names(it) }

  // Each string in [element] filled from [values]; keys and other values as they are.
  private fun fill(element: JsonElement, values: Map<String, String>): JsonElement = when (element) {
    is JsonObject -> JsonObject(element.mapValues { fill(it.value, values) })
    is JsonArray -> JsonArray(element.map { fill(it, values) })
    is JsonPrimitive -> if (element.isString) JsonPrimitive(Templates.render(element.content, values)) else element
  }

  // [text] as a JSON string's content: escaped, without the quotes.
  private fun jsonContent(text: String): String = JsonPrimitive(text).toString().let { it.substring(1, it.length - 1) }
}
