package com.phonecando.runner.notify

import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.runner.notify.LinuxJobLines.Kind
import org.junit.Assert.assertEquals
import org.junit.Test

// A job's progress comes from the Linux module's JobReporter (tested there);
// a new job has none yet, so these lines have no share.
class LinuxJobLinesTest {
  private val envs = mapOf("e1" to "Ubuntu 24.04")
  private val agents = mapOf("i1" to "Claude Code")

  private fun lines(vararg jobs: Job) = LinuxJobLines.of(jobs.toList(), envs::get, agents::get)

  @Test fun aStepWithATotalShowsItsShare() {
    assertEquals("Ubuntu 24.04 · downloading 45%", LinuxJobLines.of("Ubuntu 24.04", Kind.DOWNLOAD, 45, 100))
    assertEquals("Claude Code · setting up 100%", LinuxJobLines.of("Claude Code", Kind.SETUP, 7, 5))
    assertEquals("Ubuntu 24.04 · downloading", LinuxJobLines.of("Ubuntu 24.04", Kind.DOWNLOAD, 0, null))
  }

  @Test fun eachJobNamesItsEnvOrAgent() {
    val env = Job("job-1", JobTarget.env("e1"))
    val setup = Job("job-2", JobTarget.image("i1"))
    val install = Job("job-3", JobTarget.image("i1"), guestScript = true)
    assertEquals(
      listOf("Ubuntu 24.04 · downloading", "Claude Code · setting up", "Claude Code · installing"),
      lines(env, setup, install),
    )
  }

  @Test fun aRecordGoneMeanwhile() {
    val env = Job("job-1", JobTarget.env("gone"))
    val image = Job("job-2", JobTarget.image("gone"))
    assertEquals(listOf("Linux · downloading", "Linux machine · setting up"), lines(env, image))
  }
}
