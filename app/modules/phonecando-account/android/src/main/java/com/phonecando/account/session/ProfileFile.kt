package com.phonecando.account.session

import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.io.IOException

/** Who is signed in, as Google told the phone. The name and photo never leave the phone. */
data class AccountProfile(val email: String, val name: String?, val photoUrl: String?) {
  fun toMap(): Map<String, Any?> = mapOf("email" to email, "name" to name, "photoUrl" to photoUrl)
}

/**
 * The signed-in profile as a small JSON file next to the session token (in
 * noBackupFilesDir: a restored profile without its token would read as
 * signed in elsewhere). Not secret, so plain.
 */
class ProfileFile(private val file: File) {
  private val lock = Any()

  fun read(): AccountProfile? = synchronized(lock) {
    if (!file.isFile) return null
    try {
      val o = JSONObject(file.readText())
      val email = o.optString("email", "").ifEmpty { return null }
      AccountProfile(email, o.optNullable("name"), o.optNullable("photoUrl"))
    } catch (_: IOException) {
      null
    } catch (_: JSONException) {
      null
    }
  }

  fun write(profile: AccountProfile) = synchronized(lock) {
    val json = JSONObject()
      .put("email", profile.email)
      .put("name", profile.name ?: JSONObject.NULL)
      .put("photoUrl", profile.photoUrl ?: JSONObject.NULL)
    file.absoluteFile.parentFile?.mkdirs()
    val tmp = File(file.absoluteFile.parentFile, "${file.name}.tmp")
    tmp.writeText(json.toString())
    if (!tmp.renameTo(file)) {
      tmp.delete()
      throw IOException("could not replace ${file.name}")
    }
  }

  fun clear() = synchronized(lock) {
    file.delete()
    Unit
  }

  private fun JSONObject.optNullable(key: String): String? =
    if (isNull(key)) null else optString(key, "").ifEmpty { null }
}
