package com.phonecando.linux.registry

import com.phonecando.lre.api.Compression
import com.phonecando.lre.api.ImageConfig
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.registry.LayerDescriptor
import com.phonecando.lre.oci.registry.ResolvedImage
import org.json.JSONArray
import org.json.JSONObject

/**
 * `files/envs/<id>/base.json`: a registry env's resolved arm64 image (its
 * pinned reference, layers and Docker config), saved once resolved so a
 * retry downloads exactly these layers and image setup reads the config
 * without the network. The layer blobs sit next to it in blobs/,
 * compressed and verified. Pure (org.json).
 */
object EnvBase {
  fun encode(resolved: ResolvedImage): String = JSONObject()
    .put("ref", resolved.ref.toString())
    .put("manifestDigest", resolved.manifestDigest)
    .put("sourceHost", resolved.sourceHost)
    .put("layers", JSONArray(resolved.layers.map(::layer)))
    .put("config", config(resolved.config))
    .toString(2)

  /** Null when the text is not a base we wrote (the download then resolves again). */
  fun decode(text: String): ResolvedImage? = try {
    val o = JSONObject(text)
    val layers = o.getJSONArray("layers")
    ResolvedImage(
      ref = ImageRef.parse(o.getString("ref")),
      manifestDigest = o.getString("manifestDigest"),
      config = configOf(o.getJSONObject("config")),
      layers = (0 until layers.length()).map { layerOf(layers.getJSONObject(it)) },
      sourceHost = o.getString("sourceHost"),
    )
  } catch (_: Exception) {
    null
  }

  private fun layer(l: LayerDescriptor): JSONObject = JSONObject()
    .put("digest", l.digest)
    .put("size", l.size)
    .put("mediaType", l.mediaType)
    .put("compression", l.compression.name)

  private fun layerOf(o: JSONObject) = LayerDescriptor(
    digest = o.getString("digest"),
    size = o.getLong("size"),
    mediaType = o.getString("mediaType"),
    compression = Compression.valueOf(o.getString("compression")),
  )

  private fun config(c: ImageConfig): JSONObject = JSONObject()
    .put("env", JSONArray(c.env))
    .put("workingDir", c.workingDir ?: JSONObject.NULL)
    .put("user", c.user ?: JSONObject.NULL)
    .put("entrypoint", JSONArray(c.entrypoint))
    .put("cmd", JSONArray(c.cmd))

  private fun configOf(o: JSONObject) = ImageConfig(
    env = strings(o.getJSONArray("env")),
    workingDir = if (o.isNull("workingDir")) null else o.getString("workingDir"),
    user = if (o.isNull("user")) null else o.getString("user"),
    entrypoint = strings(o.getJSONArray("entrypoint")),
    cmd = strings(o.getJSONArray("cmd")),
  )

  private fun strings(a: JSONArray): List<String> = (0 until a.length()).map { a.getString(it) }
}
