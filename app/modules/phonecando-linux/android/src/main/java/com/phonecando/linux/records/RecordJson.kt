package com.phonecando.linux.records

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily
import org.json.JSONArray
import org.json.JSONObject

/**
 * `files/state/envs.json` and `images.json`: `{"envs": [...]}` and
 * `{"images": [...]}`, one object per record with the field names of the
 * JS types. A record we cannot read is dropped, not the whole file. Pure
 * (org.json only).
 */
object RecordJson {
  fun encodeEnvs(envs: List<EnvRecord>): String =
    JSONObject().put("envs", JSONArray(envs.map(::env))).toString(2)

  fun encodeImages(images: List<ImageRecord>): String =
    JSONObject().put("images", JSONArray(images.map(::image))).toString(2)

  /** @throws org.json.JSONException when the text is not a JSON object. */
  fun decodeEnvs(text: String): List<EnvRecord> = objects(JSONObject(text).optJSONArray("envs")).mapNotNull(::envOf)

  /** @throws org.json.JSONException when the text is not a JSON object. */
  fun decodeImages(text: String): List<ImageRecord> = objects(JSONObject(text).optJSONArray("images")).mapNotNull(::imageOf)

  private fun env(e: EnvRecord): JSONObject = JSONObject()
    .put("id", e.id)
    .put("name", e.name)
    .put("source", source(e.source))
    .put("state", e.state.id)
    .put("os", e.os?.let(::os) ?: JSONObject.NULL)
    .put("sizeBytes", e.sizeBytes)
    .put("createdAt", e.createdAt)
    .put("error", e.error ?: JSONObject.NULL)
    .put("errorCode", e.errorCode ?: JSONObject.NULL)

  private fun image(i: ImageRecord): JSONObject = JSONObject()
    .put("id", i.id)
    .put("envId", i.envId)
    .put("state", i.state.id)
    .put("failedStep", i.failedStep ?: JSONObject.NULL)
    .put("error", i.error ?: JSONObject.NULL)
    .put("errorCode", i.errorCode ?: JSONObject.NULL)
    .put("os", i.os?.let(::os) ?: JSONObject.NULL)
    .put("missingTools", JSONArray(i.missingTools))
    .put("installCommand", i.installCommand ?: JSONObject.NULL)
    .put("sizeBytes", i.sizeBytes)
    .put("createdAt", i.createdAt)

  private fun source(s: EnvSource): JSONObject = when (s) {
    is EnvSource.Default -> JSONObject().put("kind", "default").put("version", s.version)
    is EnvSource.Registry -> JSONObject().put("kind", "registry").put("image", s.image).put("tag", s.tag).put("digest", s.digest)
    EnvSource.Android -> JSONObject().put("kind", "android")
  }

  fun os(o: OsInfo): JSONObject = JSONObject()
    .put("id", o.id)
    .put("versionId", o.versionId ?: JSONObject.NULL)
    .put("idLike", JSONArray(o.idLike))
    .put("prettyName", o.prettyName ?: JSONObject.NULL)
    .put("family", o.family?.id ?: JSONObject.NULL)
    .put("shell", o.shell ?: JSONObject.NULL)

  private fun envOf(o: JSONObject): EnvRecord? {
    val id = o.str("id") ?: return null
    val source = o.optJSONObject("source")?.let(::sourceOf) ?: return null
    return EnvRecord(
      id = id,
      name = o.str("name") ?: id,
      source = source,
      state = o.str("state")?.let(EnvState::of) ?: return null,
      os = o.optJSONObject("os")?.let(::osOf),
      sizeBytes = o.optLong("sizeBytes", 0L),
      createdAt = o.optLong("createdAt", 0L),
      error = o.str("error"),
      errorCode = o.str("errorCode"),
    )
  }

  private fun imageOf(o: JSONObject): ImageRecord? {
    val id = o.str("id") ?: return null
    val envId = o.str("envId") ?: return null
    val state = o.str("state")?.let(ImageState::of) ?: return null
    return ImageRecord(
      id = id,
      envId = envId,
      state = state,
      failedStep = o.str("failedStep"),
      error = o.str("error"),
      errorCode = o.str("errorCode"),
      os = o.optJSONObject("os")?.let(::osOf),
      missingTools = strings(o.optJSONArray("missingTools")),
      installCommand = o.str("installCommand"),
      sizeBytes = o.optLong("sizeBytes", 0L),
      createdAt = o.optLong("createdAt", 0L),
    )
  }

  private fun sourceOf(o: JSONObject): EnvSource? = when (o.str("kind")) {
    "default" -> EnvSource.Default(o.str("version") ?: "")
    "registry" -> {
      val image = o.str("image")
      val tag = o.str("tag")
      if (image == null || tag == null) null else EnvSource.Registry(image, tag, o.str("digest") ?: "")
    }
    "android" -> EnvSource.Android
    else -> null
  }

  fun osOf(o: JSONObject): OsInfo? {
    val id = o.str("id") ?: return null
    return OsInfo(
      id = id,
      versionId = o.str("versionId"),
      idLike = strings(o.optJSONArray("idLike")),
      prettyName = o.str("prettyName"),
      family = o.str("family")?.let { family -> PackageFamily.entries.firstOrNull { it.id == family } },
      shell = o.str("shell"),
    )
  }

  private fun objects(a: JSONArray?): List<JSONObject> =
    if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }

  private fun strings(a: JSONArray?): List<String> =
    if (a == null) emptyList() else (0 until a.length()).mapNotNull { i -> a.opt(i) as? String }

  // optString turns JSON null into "null"; we want Kotlin null.
  private fun JSONObject.str(key: String): String? = if (isNull(key)) null else opt(key) as? String
}
