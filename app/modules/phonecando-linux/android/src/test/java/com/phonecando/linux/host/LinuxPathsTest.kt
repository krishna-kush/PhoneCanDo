package com.phonecando.linux.host

import com.phonecando.lre.image.delete.ImageDelete
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

// JVM checks that our paths agree with what lre and the runner expect.
class LinuxPathsTest {
  private val paths = LinuxPaths(File("/data/user/0/pkg/files"))

  @Test fun imagesLiveWhereTheRunnerReadsThem() {
    assertEquals("/data/user/0/pkg/files/images/a1b2c3/run/engine.env", paths.image("a1b2c3").engineEnv.path)
  }

  @Test fun ourTrashDirsAreTheOnesImageDeleteUses() {
    assertEquals(ImageDelete.trashFor(paths.image("a1b2c3")), paths.imagesTrash)
    assertEquals(ImageDelete.trashFor(paths.envAsLayout("k3x9qa")), paths.envsTrash)
  }

  @Test fun registryEnvsKeepBaseAndBlobsTogether() {
    assertEquals("/data/user/0/pkg/files/envs/k3x9qa/base.json", paths.envBase("k3x9qa").path)
    assertEquals("/data/user/0/pkg/files/envs/k3x9qa/blobs", paths.envBlobs("k3x9qa").path)
  }
}
