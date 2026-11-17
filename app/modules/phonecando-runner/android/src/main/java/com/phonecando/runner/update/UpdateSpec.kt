package com.phonecando.runner.update

/**
 * One update APK to download, as latest.json names it: where it comes
 * from ([url], a GitHub release asset of ours), its file [name], its [size]
 * in bytes and lower-case hex [sha256], and the build it brings
 * ([versionCode], [version]). Two specs are the same download only when
 * every field matches.
 */
data class UpdateSpec(
  val url: String,
  val name: String,
  val size: Long,
  val sha256: String,
  val versionCode: Int,
  val version: String,
)

/** A spec we refuse, with a short reason for JS. */
class UpdateSpecException(message: String) : Exception(message)

// What startUpdateDownload accepts: only our own release assets, a plain
// `.apk` file name that stays inside the updates folder, a real size and a
// full sha256. Pure.
object SpecRules {
  const val RELEASES = "https://github.com/krishna-kush/PhoneCanDo/releases/download/"

  private val HEX64 = Regex("^[0-9a-fA-F]{64}$")

  /** The spec in [map] (JS numbers arrive as doubles). @throws UpdateSpecException when it is not one we download. */
  fun parse(map: Map<String, Any?>): UpdateSpec {
    val url = map["url"] as? String ?: throw UpdateSpecException("no url")
    val name = map["name"] as? String ?: throw UpdateSpecException("no name")
    val size = (map["size"] as? Number)?.toDouble() ?: throw UpdateSpecException("no size")
    val sha256 = map["sha256"] as? String ?: throw UpdateSpecException("no sha256")
    val versionCode = (map["versionCode"] as? Number)?.toDouble() ?: throw UpdateSpecException("no versionCode")
    val version = map["version"] as? String ?: throw UpdateSpecException("no version")
    refusal(url, name, size, sha256, versionCode, version)?.let { throw UpdateSpecException(it) }
    return UpdateSpec(url, name, size.toLong(), sha256.lowercase(), versionCode.toInt(), version)
  }

  /** Why these fields are not a download of ours, or null when they are. */
  fun refusal(url: String, name: String, size: Double, sha256: String, versionCode: Double, version: String): String? = when {
    !url.startsWith(RELEASES) -> "url is not a PhoneCanDo release asset"
    // The prefix must stay the prefix: no climbing out of it, no spaces.
    ".." in url || url.any { it.isWhitespace() } -> "url is not a PhoneCanDo release asset"
    !name.endsWith(".apk") || name.length <= ".apk".length -> "name is not an .apk"
    '/' in name || '\\' in name || ".." in name || '\u0000' in name -> "name is not a plain file name"
    !size.isFinite() || size <= 0 || size != Math.floor(size) -> "size is not a byte count"
    !HEX64.matches(sha256) -> "sha256 is not 64 hex characters"
    !versionCode.isFinite() || versionCode <= 0 || versionCode != Math.floor(versionCode) || versionCode > Int.MAX_VALUE ->
      "versionCode is not a build number"
    version.isBlank() -> "no version"
    else -> null
  }
}
