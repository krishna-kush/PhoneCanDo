package com.phonecando.linux.jobs

import com.phonecando.linux.records.EnvSource
import com.phonecando.linux.records.EnvState
import com.phonecando.linux.records.ImageState
import com.phonecando.linux.records.Samples
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// JVM checks for what a process death leaves behind and how we fix it on module create.
class RecoveryTest {
  private val registry = EnvSource.Registry("alpine", "3.22", "")

  @Test fun jobsCutShortBecomeRetryableFailures() {
    val plan = Recovery.plan(
      listOf(Samples.env("e1", registry, EnvState.DOWNLOADING)),
      listOf(Samples.image("i1", state = ImageState.CREATING)),
    ) { false }
    val env = plan.envs.single()
    val image = plan.images.single()
    assertEquals(EnvState.FAILED, env.state)
    assertEquals("cancelled", env.errorCode)
    assertEquals("cancelled: ${Recovery.MESSAGE}", env.error)
    assertEquals(ImageState.FAILED, image.state)
    assertEquals("cancelled", image.errorCode)
  }

  @Test fun aLiveJobIsLeftAlone() {
    val envs = listOf(Samples.env("e1", registry, EnvState.DOWNLOADING))
    val images = listOf(Samples.image("i1", state = ImageState.CREATING), Samples.image("i2", state = ImageState.RESETTING))
    val plan = Recovery.plan(envs, images) { true }
    assertEquals(envs, plan.envs)
    assertEquals(images, plan.images)
  }

  @Test fun aResetCutShortLeavesAReadyImageWithTheErrorNoted() {
    val image = Recovery.plan(emptyList(), listOf(Samples.image("i1", state = ImageState.RESETTING))) { false }.images.single()
    assertEquals(ImageState.READY, image.state)
    assertEquals("cancelled", image.errorCode)
    assertNull(image.failedStep)
  }

  @Test fun aDeleteCutShortIsFinished() {
    val plan = Recovery.plan(emptyList(), listOf(Samples.image("i1", state = ImageState.DELETING))) { false }
    assertEquals(listOf("i1"), plan.finishDeletes)
  }

  @Test fun settledRecordsAreUntouched() {
    val plan = Recovery.plan(Samples.envs, Samples.images) { false }
    assertEquals(Samples.envs, plan.envs)
    assertEquals(Samples.images, plan.images)
    assertEquals(emptyList<String>(), plan.finishDeletes)
  }

  @Test fun livenessIsAskedPerTarget() {
    val plan = Recovery.plan(
      listOf(Samples.env("same", registry, EnvState.DOWNLOADING)),
      listOf(Samples.image("same", state = ImageState.CREATING)),
    ) { it == JobTarget.image("same") }
    assertEquals(EnvState.FAILED, plan.envs.single().state)
    assertEquals(ImageState.CREATING, plan.images.single().state)
  }
}
