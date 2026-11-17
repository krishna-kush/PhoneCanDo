package com.phonecando.runner.update

// What goes from the updates folder, and when. It holds one update at a
// time, so anything there that is not the recorded download's is left over
// (an older build's APK, a `.part` of a spec we gave up on, the old JS
// downloader's APKs). Pure.
object CleanRules {
  /**
   * After an install (each process start, and PackageReplacedReceiver): the
   * record and the whole folder go once the build installed now
   * ([installed], PackageInfo's longVersionCode) is the recorded one or
   * newer. With no record nothing there is ours to keep.
   */
  fun afterInstall(installed: Long, record: UpdateRecord?): Boolean =
    record == null || installed >= record.spec.versionCode

  /**
   * A start of download [name] keeps only its own `.part`, and only when it
   * is [resumable]: the record is this very spec and not done (a finished
   * file with no done record is not one we checked, and a partial of
   * another spec is not this file).
   */
  fun keptOnStart(entry: String, name: String, resumable: Boolean): Boolean =
    resumable && entry == name + UpdatePaths.PART
}
