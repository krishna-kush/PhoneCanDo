package com.phonecando.models.store

import java.io.File

/** Where our model files live: `files/models/` (lme's ModelLayout inside), and the Hugging Face token. */
object ModelPaths {
  fun models(filesDir: File): File = File(filesDir, "models")

  fun token(filesDir: File): File = File(File(filesDir, "state"), "hf-token.bin")
}
