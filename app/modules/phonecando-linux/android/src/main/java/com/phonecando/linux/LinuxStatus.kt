package com.phonecando.linux

import com.phonecando.lre.api.PayloadNames

// Whether this build can run Linux images, and the paths it would use.
// reason is empty when available, otherwise it says why not. A Linux image
// runs from nativeLibraryDir, the only place Android lets us exec from (AGP
// packages only lib*.so names): the launcher built from lre/launcher by this
// module's CMake, proot and its loader staged from lre/proot (PayloadNames).
// The play channel ships none of them.
data class LinuxStatus(
  val available: Boolean,
  val reason: String,
  val libDir: String,
  val launcher: String,
  val proot: String,
  val loader: String,
) {
  fun toMap(): Map<String, Any> = mapOf(
    "available" to available,
    "reason" to reason,
    "libDir" to libDir,
    "launcher" to launcher,
    "proot" to proot,
    "loader" to loader,
  )

  companion object {
    // Pure: the channel, the native lib dir and a file check in, the status out.
    fun of(channel: String, libDir: String, isFile: (String) -> Boolean): LinuxStatus {
      val names = listOf(PayloadNames.LAUNCHER, PayloadNames.PROOT, PayloadNames.LOADER)
      val paths = names.map { "$libDir/$it" }
      val missing = names.filterIndexed { i, _ -> !isFile(paths[i]) }
      val reason = when {
        channel == "play" -> "the play channel ships no Linux"
        missing.isNotEmpty() -> "missing ${missing.joinToString(", ")} in the native lib dir"
        else -> ""
      }
      return LinuxStatus(reason.isEmpty(), reason, libDir, paths[0], paths[1], paths[2])
    }
  }
}
