package com.phonecando.models.store

import java.io.File

/** Where our model files live: `files/models/` (lme's ModelLayout inside), the Hugging Face token and the downloads to resume. */
object ModelPaths {
  fun models(filesDir: File): File = File(filesDir, "models")

  fun token(filesDir: File): File = File(File(filesDir, "state"), "hf-token.bin")

  fun resumeList(filesDir: File): File = File(File(filesDir, "state"), "model-downloads-to-resume.txt")
}
