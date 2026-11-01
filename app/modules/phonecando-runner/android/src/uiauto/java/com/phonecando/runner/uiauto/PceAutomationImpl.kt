package com.phonecando.runner.uiauto

import android.os.Build
import com.phonecando.pce.android.A11yBackend
import com.phonecando.pce.android.A11yServiceProvider
import com.phonecando.pce.api.Action
import com.phonecando.pce.api.ActOptions
import com.phonecando.pce.api.Bounds
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.Node
import com.phonecando.pce.api.NodeFlag
import com.phonecando.pce.api.ObserveOptions
import com.phonecando.pce.api.Snapshot
import com.phonecando.pce.api.SnapshotId
import com.phonecando.pce.api.Window
import com.phonecando.pce.core.Pce
import com.phonecando.pce.json.PceJson
import com.phonecando.pce.pack.FlowResult
import com.phonecando.runner.AutomationGate
import com.phonecando.runner.PceAutomation
import com.phonecando.runner.packs.PackStore
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject

// Full-only PCE adapter. The bridge only sees PceAutomation; PCE and
// accessibility backend classes are absent from play builds.
@OptIn(ExperimentalPceApi::class)
class PceAutomationImpl(
  private val service: PhoneCanDoAccessibilityService,
) : PceAutomation {
  private val backend = A11yBackend(A11yServiceProvider { service })
  private val pce = Pce.create(backend)
  private val packs = PackStore(service, pce)

  override fun describe(): JSONObject {
    val capabilities = JSONArray()
    backend.capabilities.forEach { capabilities.put(it.name.lowercase()) }
    return JSONObject()
      .put("contract", "1.0")
      .put("pce", "0.1.0")
      .put("backend", backend.id)
      .put("capabilities", capabilities)
      .put("sdk", Build.VERSION.SDK_INT)
      .put("model", Build.MODEL)
      .put("automation", true)
      .put("unlocked", AutomationGate.enabled)
      .put("packs", packs.describeJson())
  }

  override fun observe(options: JSONObject): JSONObject = runBlocking {
    val request = ObserveOptions(
      includeInvisible = options.optBoolean("includeInvisible", false),
      includeWindows = options.optBoolean("windows", true),
      screenshot = options.optBoolean("screenshot", false),
      maxNodes = options.optInt("maxNodes", 500).coerceIn(1, 2_000),
      timeoutMs = options.optLong("timeoutMs", 5_000).coerceIn(1_000, 15_000),
    )
    when (val result = pce.observe(request)) {
      is PceResult.Ok -> result.value.toJson()
      is PceResult.Err -> error(result.error)
    }
  }

  override fun act(request: JSONObject): JSONObject = runBlocking {
    val snapshotId = request.optLong("snapshotId", 0L)
    if (snapshotId <= 0L) return@runBlocking badRequest("snapshotId is required")
    val actionElement = request.opt("action")
      ?: return@runBlocking badRequest("action is required")
    val actionText = when (actionElement) {
      is JSONObject -> actionElement.toString()
      is String -> actionElement
      else -> return@runBlocking badRequest("action must be an object")
    }
    val action = when (val decoded = PceJson.decodeActionStrict(actionText)) {
      is PceResult.Ok -> decoded.value
      is PceResult.Err -> return@runBlocking error(decoded.error)
    }

    // Decode the postcondition before running the action: a bad selector must
    // not leave a side effect behind.
    val expect = request.opt("expect")?.let { element ->
      val text = when (element) {
        is JSONObject -> element.toString()
        is String -> element
        else -> return@runBlocking badRequest("expect must be an object")
      }
      when (val decoded = PceJson.decodeSelectorStrict(text)) {
        is PceResult.Ok -> decoded.value
        is PceResult.Err -> return@runBlocking error(decoded.error)
      }
    }

    val timeoutMs = request.optLong("timeoutMs", 30_000L).coerceIn(1_000L, 120_000L)
    when (val result = pce.act(SnapshotId(snapshotId), action, ActOptions(timeoutMs))) {
      is PceResult.Err -> error(result.error)
      is PceResult.Ok -> {
        val data = JSONObject()
          .put("snapshotId", result.value.snapshotId.value)
          .put("backend", result.value.backend)
          .put("ms", result.value.durationMs)
        if (expect != null) {
          val expectMs = request.optLong("expectTimeoutMs", 5_000L).coerceIn(500L, 30_000L)
          when (val waited = pce.act(result.value.snapshotId, Action.Wait(expect, expectMs), ActOptions(expectMs))) {
            is PceResult.Err -> error(waited.error)
            is PceResult.Ok -> data.put("expect", true)
          }
        } else {
          data
        }
      }
    }
  }

  override fun pack(request: JSONObject): JSONObject {
    return when (request.optString("action")) {
      "list" -> JSONObject()
        .put("ok", true)
        .put("packs", packs.describeJson())
      "refresh" -> {
        val url = request.optString("manifestUrl").takeIf { it.isNotBlank() }
          ?: return badRequest("manifestUrl is required")
        when (val result = packs.refresh(url)) {
          is PceResult.Err -> error(result.error)
          is PceResult.Ok -> JSONObject()
            .put("ok", true)
            .put("installed", JSONArray().apply {
              result.value.installed.forEach {
                put(JSONObject().put("id", it.id).put("version", it.version).put("active", it.active))
              }
            })
            .put("failed", JSONArray().apply {
              result.value.failed.forEach {
                put(errorBody(it.error).put("id", it.id).put("version", it.version))
              }
            })
        }
      }
      "rollback" -> {
        val id = request.optString("id").takeIf { it.isNotBlank() }
          ?: return badRequest("id is required")
        when (val result = packs.rollback(id)) {
          is PceResult.Err -> error(result.error)
          is PceResult.Ok -> JSONObject()
            .put("ok", true)
            .put("pack", packJson(result.value))
        }
      }
      "run" -> {
        val id = request.optString("id").takeIf { it.isNotBlank() }
          ?: return badRequest("id is required")
        val flow = request.optString("flow").takeIf { it.isNotBlank() }
          ?: return badRequest("flow is required")
        val rawParams = request.opt("params")
        if (rawParams != null && rawParams !is JSONObject) {
          return badRequest("params must be an object")
        }
        val params = mutableMapOf<String, String>()
        (rawParams as? JSONObject)?.let { objectParams ->
          val keys = objectParams.keys()
          while (keys.hasNext()) {
            val name = keys.next()
            val value = objectParams.opt(name)
            if (value !is String) return badRequest("params.$name must be a string")
            params[name] = value
          }
        }
        when (val result = runBlocking { packs.run(id, flow, params) }) {
          is PceResult.Err -> error(result.error)
          is PceResult.Ok -> JSONObject()
            .put("ok", true)
            .put("flow", flowJson(result.value))
        }
      }
      else -> badRequest("action must be list, refresh, rollback or run")
    }
  }

  override fun close() {
    runCatching { runBlocking { pce.close() } }
  }

  private fun badRequest(message: String): JSONObject = JSONObject()
    .put("ok", false)
    .put("code", "bad_request")
    .put("message", message)

  private fun error(error: PceError): JSONObject {
    val out = JSONObject()
      .put("ok", false)
      .put("code", error.code.name)
      .put("message", error.message)
    error.recovery?.let {
      out.put("recover", JSONObject().put("action", it.action).put("hint", it.hint ?: ""))
    }
    if (error.candidates.isNotEmpty()) {
      out.put("candidates", JSONArray(error.candidates.map { it.value }))
    }
    return out
  }

  private fun errorBody(error: PceError): JSONObject = JSONObject()
    .put("code", error.code.name)
    .put("message", error.message)

  private fun packJson(pack: PackStore.InstalledPack): JSONObject = JSONObject()
    .put("id", pack.id)
    .put("active", pack.active ?: JSONObject.NULL)
    .put("versions", JSONArray(pack.versions))

  private fun flowJson(result: FlowResult): JSONObject = JSONObject()
    .put("id", result.flowId)
    .put("steps", result.steps)
    .put("results", JSONArray().apply {
      result.results.forEach { action ->
        put(
          JSONObject()
            .put("snapshotId", action.snapshotId.value)
            .put("backend", action.backend)
            .put("ms", action.durationMs)
            .put("action", JSONObject(PceJson.encodeAction(action.action)))
        )
      }
    })

  private fun Snapshot.toJson(): JSONObject {
    val out = JSONObject()
      .put("snapshotId", id.value)
      .put("backend", backend)
      .put("eventSeq", service.eventSeq)
      .put("stable", stable)
      .put("truncated", truncated)
      .put("focused", focusedNodeId?.value ?: JSONObject.NULL)
      .put("device", JSONObject()
        .put("sdk", device.sdk)
        .put("model", device.model ?: "")
        .put("display", JSONArray().put(device.displayWidth).put(device.displayHeight))
        .put("rotation", device.rotation)
        .put("screenOn", device.screenOn)
        .put("keyguard", device.keyguard)
        .put("ime", device.imeVisible))
      .put("windows", JSONArray().apply { windows.forEach { put(it.toJson()) } })
      .put("nodes", JSONArray().apply { nodes.forEach { put(it.toJson()) } })
    putOpt(out, "package", packageName)
    // The published PCE AAR may predate its optional activity provider;
    // the host service already tracks the same window-state event.
    putOpt(out, "activity", activityName ?: service.activityName(packageName))
    screenshot?.let {
      out.put("screenshot", JSONObject()
        .put("path", it.path)
        .put("w", it.width)
        .put("h", it.height)
        .put("mimeType", it.mimeType)
        .put("secure", it.secure))
    }
    return out
  }

  private fun Window.toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("type", type.name.lowercase())
    .put("layer", layer)
    .put("bounds", bounds.toJson())
    .put("active", active)
    .put("focused", focused)
    .put("package", packageName ?: "")

  private fun Node.toJson(): JSONObject = JSONObject()
    .put("i", id.value)
    .put("depth", depth)
    .put("bounds", bounds.toJson())
    .put("clickable", clickable)
    .put("editable", editable)
    .put("scrollable", scrollable)
    .put("visible", visible)
    .put("enabled", enabled)
    .put("focused", has(NodeFlag.FOCUSED))
    .put("selected", has(NodeFlag.SELECTED))
    .put("checked", has(NodeFlag.CHECKED))
    .put("password", has(NodeFlag.PASSWORD))
    .apply {
      parentId?.let { put("parent", it.value) }
      putOpt(this, "pkg", packageName)
      putOpt(this, "cls", className)
      putOpt(this, "id", viewId)
      putOpt(this, "text", text)
      putOpt(this, "desc", contentDescription)
    }

  private fun Bounds.toJson(): JSONArray = JSONArray()
    .put(left)
    .put(top)
    .put(right)
    .put(bottom)

  private fun putOpt(out: JSONObject, name: String, value: String?) {
    if (!value.isNullOrEmpty()) out.put(name, value)
  }
}
