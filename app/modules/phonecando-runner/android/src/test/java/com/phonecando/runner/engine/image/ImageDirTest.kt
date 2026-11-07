package com.phonecando.runner.engine.image

import com.phonecando.runner.engine.EngineStartError
import com.phonecando.runner.engine.EngineStartException
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.nio.file.Files

// JVM checks for reading an image's engine.env.
class ImageDirTest {
  private val files = Files.createTempDirectory("files").toFile()
  private val image = ImageDir.of(files, "img1")

  @After fun cleanup() {
    files.deleteRecursively()
  }

  @Test fun parsesKeyValueLines() {
    val env = EngineEnvFile.parse(
      "HOME=/x/home\r\nTMPDIR=/x/tmp\n\nPATH=/x/shims:/system/bin\nBAD LINE\n=nokey\n1X=no\nEMPTY=\nURL=a=b=c\nHOME=/later\n",
    )
    assertEquals(
      linkedMapOf(
        "HOME" to "/later",
        "TMPDIR" to "/x/tmp",
        "PATH" to "/x/shims:/system/bin",
        "EMPTY" to "",
        "URL" to "a=b=c",
      ),
      env,
    )
  }

  @Test fun readsTheImagesFile() {
    assertEquals(File(files, "images/img1"), image.root)
    image.engineEnv.parentFile.mkdirs()
    image.engineEnv.writeText("HOME=/h\nTMPDIR=/t\nSHELL=/s/bash\nPHONECANDO_IMAGE=/r\n")
    assertEquals(mapOf("HOME" to "/h", "TMPDIR" to "/t", "SHELL" to "/s/bash", "PHONECANDO_IMAGE" to "/r"), image.readEnv())
  }

  @Test fun homeAndTmpDefaultToTheImageFolders() {
    image.engineEnv.parentFile.mkdirs()
    image.engineEnv.writeText("PATH=/bin\n")
    val env = image.readEnv()
    assertEquals(image.home.path, env["HOME"])
    assertEquals(image.tmp.path, env["TMPDIR"])
  }

  @Test fun missingEngineEnvIsImageNotReady() {
    try {
      image.readEnv()
      fail("an image without engine.env was ready")
    } catch (e: EngineStartException) {
      assertEquals(EngineStartError.IMAGE_NOT_READY, e.error)
      assertEquals("image_not_ready", e.message!!.substringBefore(':'))
    }
  }
}
