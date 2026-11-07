package com.phonecando.linux.jobs

import com.phonecando.linux.records.LinuxRecords
import com.phonecando.linux.records.Samples
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

// JVM checks for a job registered in a record transaction: kept on success, ended on failure.
class JobTransactionTest {
  @get:Rule val tmp = TemporaryFolder()

  private val jobs = JobRegistry()

  @Test fun theJobAndTheRecordLandTogether() {
    val records = LinuxRecords(tmp.root)
    val job = records.transactWithJob(jobs) { begin ->
      putImage(Samples.image("a1b2c3"))
      begin(JobTarget.image("a1b2c3"))
    }
    assertTrue(jobs.isLive(JobTarget.image("a1b2c3")))
    assertEquals(job, jobs.live(JobTarget.image("a1b2c3")))
    assertEquals(listOf("a1b2c3"), records.images().map { it.id })
  }

  @Test fun aCheckFailingAfterBeginFreesTheTarget() {
    val records = LinuxRecords(tmp.root)
    try {
      records.transactWithJob(jobs) { begin ->
        begin(JobTarget.env("e1"))
        throw IllegalStateException("not in a state for this")
      }
      fail("the failure must pass through")
    } catch (_: IllegalStateException) {
    }
    assertFalse(jobs.isLive(JobTarget.env("e1")))
  }

  @Test fun aFailedWriteFreesTheTargetAndKeepsTheRecordsAsTheyWere() {
    // A file where the state dir should be: every write fails.
    val blocked = File(tmp.root, "state").apply { writeText("") }
    val records = LinuxRecords(File(blocked, "inner"))
    try {
      records.transactWithJob(jobs) { begin ->
        putImage(Samples.image("a1b2c3"))
        begin(JobTarget.image("a1b2c3"))
      }
      fail("the write must fail")
    } catch (_: Exception) {
    }
    assertFalse(jobs.isLive(JobTarget.image("a1b2c3")))
    assertEquals(emptyList<Any>(), records.images())
  }
}
