package com.phonecando.linux.defaultimage

import org.json.JSONObject

/**
 * `default-image/image.json`, staged next to the image by
 * lre/images/default/lock/stage.sh from lock.json. Pure.
 */
data class DefaultImageInfo(val version: String, val sha256: String?, val size: Long?, val release: String?) {
  companion object {
    /** Null when the text is not a staged image.json (no version). */
    fun parse(text: String): DefaultImageInfo? = try {
      val o = JSONObject(text)
      val version = o.opt("version")?.takeUnless { it == JSONObject.NULL }?.toString()?.takeIf { it.isNotBlank() }
      version?.let {
        DefaultImageInfo(
          version = it,
          sha256 = o.opt("sha256") as? String,
          size = (o.opt("size") as? Number)?.toLong()?.takeIf { size -> size > 0 },
          release = o.opt("release")?.takeUnless { r -> r == JSONObject.NULL }?.toString(),
        )
      }
    } catch (_: Exception) {
      null
    }
  }
}
