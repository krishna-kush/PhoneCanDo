package com.phonecando.runner.update

import java.io.File

/**
 * Where the update download lives under the app's filesDir: the APK in
 * `updates/<name>`, arriving in `updates/<name>.part` beside it (the old JS
 * downloader used the same folder: expo-file-system's Paths.document is
 * filesDir), and its record and resume entry in `state/`. Pure.
 */
class UpdatePaths(filesDir: File) {
  val dir = File(filesDir, "updates")
  val record = File(File(filesDir, "state"), "update-download.json")

  /** The update download to run again when the app starts (network's ResumeList). */
  val resumeList = File(File(filesDir, "state"), "update-downloads-to-resume.txt")

  fun apk(name: String) = File(dir, name)

  fun part(name: String) = File(dir, name + PART)

  companion object {
    const val PART = ".part"
  }
}
