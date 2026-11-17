package com.phonecando.runner.notify

import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobTarget
import org.junit.Assert.assertEquals
import org.junit.Test

// A job's progress comes from the Linux module's JobReporter (tested there);
// a new job has none yet, so these lines have no share but a setup's start.
class LinuxJobLinesTest {
  private val envs = mapOf("e1" to "Ubuntu 24.04")
  private val agents = mapOf("i1" to "Claude Code", "i2" to "Gemini CLI")
  private val shares = mapOf("job-3" to InstallShares.Share("a1", 0.345, updating = false))

  private fun lines(vararg jobs: Job) =
    LinuxJobLines.of(jobs.toList(), envs::get, { agents[it.target.id] }, resetting = { it == "i2" }, installShare = shares::get).map { it.line }

  @Test fun eachJobNamesItsEnvOrAgent() {
    val env = Job("job-1", JobTarget.env("e1"))
    val setup = Job("job-2", JobTarget.image("i1"))
    val install = Job("job-3", JobTarget.image("i1"), guestScript = true)
    val reset = Job("job-4", JobTarget.image("i2"))
    assertEquals(
      listOf("Ubuntu 24.04 · downloading", "Claude Code · setting up 0%", "Claude Code · installing 34%", "Gemini CLI · resetting"),
      lines(env, setup, install, reset),
    )
  }

  @Test fun aScriptSaysTheAppsShareOnceToldAndWhetherItUpdates() {
    assertEquals(JobLine("Claude Code", "installing", null), LinuxJobLines.script("Claude Code", null))
    assertEquals(JobLine("Claude Code", "updating 99%", 0.999), LinuxJobLines.script("Claude Code", InstallShares.Share("a1", 0.999, updating = true)))
  }

  // The app's setupFraction: unpacking is most of it, the other steps say
  // where they are in the whole, so the share never goes back.
  @Test fun aSetupCountsOverTheWholeSetup() {
    assertEquals(0.05, LinuxJobLines.setupShare("unpack", 0, 100), 1e-9)
    assertEquals(0.425, LinuxJobLines.setupShare("unpack", 50, 100), 1e-9)
    assertEquals(0.8, LinuxJobLines.setupShare("detect", 4, 8), 1e-9)
    assertEquals(0.96, LinuxJobLines.setupShare("measure", 7, 8), 1e-9)
    assertEquals(0.0, LinuxJobLines.setupShare("someday", 1, 2), 1e-9)
  }

  @Test fun aRecordGoneMeanwhile() {
    val env = Job("job-1", JobTarget.env("gone"))
    val image = Job("job-2", JobTarget.image("gone"))
    assertEquals(listOf("Linux · downloading", "Linux machine · setting up 0%"), lines(env, image))
  }
}
