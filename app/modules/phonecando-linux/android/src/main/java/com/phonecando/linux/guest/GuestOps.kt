package com.phonecando.linux.guest

import com.phonecando.linux.LinuxHost
import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.linux.guest.activity.ActivityMeter
import com.phonecando.linux.guest.activity.AppRxCounter
import com.phonecando.linux.guest.activity.Pulse
import com.phonecando.linux.jobs.Job
import com.phonecando.linux.jobs.JobReporter
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.linux.records.ImageState
import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.api.LreException
import com.phonecando.network.CancelSignal
import com.phonecando.network.Progress
import java.io.File
import java.io.InputStream

/** How a guest command ended: its exit code and the start of its stdout. */
data class CommandResult(val exitCode: Int, val stdout: String) {
  fun toMap(): Map<String, Any> = mapOf("exitCode" to exitCode, "stdout" to stdout)
}

/**
 * Scripts and commands we run inside a ready Linux image: an agent's
 * install or update script as a job ([runScript]), its version check as
 * one call ([runCommand]). Both refuse while a create or reset runs on the
 * image. A script is the image's job, so a second script, a reset or a
 * retry is refused meanwhile and a delete cancels it; an engine start, a
 * terminal and a guest command still go ahead. The caller prepares the
 * image first (prepareImageForStart): the shims and launch.conf must match
 * this APK.
 */
class GuestOps(private val host: LinuxHost) {
  /**
   * Starts [script] (POSIX sh, run as `sh -s` with the script on stdin) as
   * a job on the image. It logs to logs/install.log; its events carry the
   * script's phase, retry and last lines, its time so far and what the app
   * received meanwhile, about once a second even when it prints nothing.
   * It ends ok on exit 0, `command_failed` on any other, `timed_out` past
   * [timeoutSec], `cancelled` on cancelJob.
   */
  fun runScript(imageId: String, script: String, timeoutSec: Long, label: String): Job {
    require(script.isNotBlank() && script.length <= MAX_SCRIPT_CHARS) { "a script of 1 to $MAX_SCRIPT_CHARS characters" }
    requireTimeout(timeoutSec)
    val name = label.lineSequence().firstOrNull()?.trim()?.take(MAX_LABEL_CHARS)?.ifEmpty { null } ?: DEFAULT_LABEL
    val layout = linuxLayout(imageId)
    // A read-only transaction: the state check and the job's begin are one step against a reset's.
    val job = host.records.transact {
      val image = image(imageId) ?: throw LreException.NotFound("image $imageId")
      if (image.state != ImageState.READY) throw host.images.busy(image)
      host.jobs.begin(JobTarget.image(imageId), guestScript = true)
    }
    // No image lock: a prepare for the terminal may rewrite launch.conf and the
    // shims meanwhile (same content, written whole). The image record stays as
    // it is: a failed script changes nothing there.
    host.run(job, onError = {}) { reporter -> scriptJob(layout, script, timeoutSec, name, job, reporter) }
    return job
  }

  /**
   * Runs [argv] in the image (argv[0] a guest command or path, looked up on
   * the guest PATH) and returns its exit code and the first 64 KiB of its
   * stdout; stderr is dropped. `timed_out` past [timeoutSec].
   */
  fun runCommand(imageId: String, argv: List<String>, timeoutSec: Long): CommandResult {
    require(argv.isNotEmpty() && argv[0].isNotEmpty()) { "an empty command" }
    requireTimeout(timeoutSec)
    val layout = linuxLayout(imageId)
    return host.imageLocks.with(imageId) {
      // Again under the lock: a reset or delete may have begun meanwhile.
      linuxLayout(imageId)
      val stdout = CappedText(MAX_STDOUT_BYTES)
      val end = GuestProcess().run(
        layout, listOf("sh", "-c", EXEC_ARGS) + argv, ByteArray(0), timeoutSec * 1000, CancelSignal.NEVER,
        mergeStderr = false, output = stdout::readFrom,
      )
      when (end) {
        is GuestProcess.End.Exited -> CommandResult(end.code, stdout.text())
        GuestProcess.End.TimedOut -> throw timedOut(argv[0], timeoutSec)
        GuestProcess.End.Cancelled -> throw LreException.Cancelled()
      }
    }
  }

  private fun scriptJob(
    layout: ImageLayout,
    script: String,
    timeoutSec: Long,
    label: String,
    job: Job,
    reporter: JobReporter,
  ) {
    val output = ScriptOutput()
    val activity = ActivityMeter(AppRxCounter, host.android::online)
    val report = { exitCode: Int? ->
      reporter.reportScript(output.detail(exitCode, activity.now()), Progress(STEP, output.phases, null))
    }
    report(null)
    // A download can print nothing for minutes: the pulse reads the counter and reports anyway.
    val end = Pulse(PULSE_MS) {
      activity.sample()
      report(null)
    }.use {
      ScriptLog(File(layout.logs, ScriptLog.FILE_NAME), label).use { log ->
        GuestProcess().run(
          layout, listOf("sh", "-s"), script.toByteArray(Charsets.UTF_8), timeoutSec * 1000, job.cancel,
          mergeStderr = true,
        ) { stream ->
          readLines(stream) { line ->
            log.line(output.line(line))
            report(null)
          }
        }
      }
    }
    report((end as? GuestProcess.End.Exited)?.code)
    when (end) {
      is GuestProcess.End.Exited ->
        if (end.code != 0) throw LinuxError(LinuxErrorCode.COMMAND_FAILED, "$label exited with ${end.code}")
      GuestProcess.End.TimedOut -> throw timedOut(label, timeoutSec)
      GuestProcess.End.Cancelled -> throw LreException.Cancelled()
    }
  }

  /** The end of the image's last script log (logs/install.log); null before any script ran there. */
  fun lastLog(imageId: String): ScriptLogEnd? =
    ScriptLogEnd.read(File(host.paths.image(host.images.image(imageId).id).logs, ScriptLog.FILE_NAME))

  // The image's dir once it can run a guest program: ready, no job on it, Linux allowed and present.
  private fun linuxLayout(imageId: String): ImageLayout {
    if (!host.images.startable(imageId)) {
      throw LinuxError(LinuxErrorCode.NOT_FOUND, "image $imageId has no Linux system")
    }
    return host.paths.image(imageId)
  }

  private fun requireTimeout(timeoutSec: Long) =
    require(timeoutSec in 1..MAX_TIMEOUT_SEC) { "a time limit of 1 to $MAX_TIMEOUT_SEC s" }

  private fun timedOut(what: String, timeoutSec: Long) =
    LinuxError(LinuxErrorCode.TIMED_OUT, "$what ran past its $timeoutSec s limit and was stopped")

  private fun readLines(stream: InputStream, onLine: (String) -> Unit) {
    val lines = LineSplitter(onLine = onLine)
    val buf = ByteArray(GuestProcess.BUFFER)
    while (true) {
      val n = stream.read(buf)
      if (n < 0) break
      lines.feed(buf, n)
    }
    lines.finish()
  }

  private companion object {
    // Every event of a script job has this step; its `phase` tells where the script is.
    const val STEP = "script"
    // One counter reading and one event a second while a script runs, output or not.
    const val PULSE_MS = 1_000L
    const val DEFAULT_LABEL = "script"
    const val MAX_LABEL_CHARS = 80
    const val MAX_SCRIPT_CHARS = 1024 * 1024
    const val MAX_TIMEOUT_SEC = 4L * 60 * 60
    const val MAX_STDOUT_BYTES = 64 * 1024

    // `sh -c 'exec "$0" "$@"' argv...`: the guest shell finds argv[0] on the guest PATH, or takes its path.
    const val EXEC_ARGS = "exec \"\$0\" \"\$@\""
  }
}
