package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.render.InstallRenderer
import com.phonecando.agents.kit.render.RuntimeBinding
import java.io.File
import java.io.PrintStream

// kit-cli render-install --kind <dir> --family <f> [--runtimes <dir>] [--update]
// prints a kind's install script (its update with --update) for an image of
// that family, exactly as the phone renders it, on stdout: the raw script,
// for the guest's `sh -s` with HOME the image home. --runtimes is the
// folder of runtime plugins, by default agents/runtimes beside the kind's
// agents/<type>/. Exit 1 when there is nothing to render (no install, or no
// recipe for that family).
object RenderInstall {
  const val USAGE = "kit-cli render-install --kind <dir> --family <family> [--runtimes <dir>] [--update]"

  /** What render-install was asked for. */
  data class Request(val kind: File, val family: String, val runtimes: File, val update: Boolean)

  /** The request in [args] (after the command). Throws IllegalArgumentException for bad usage. */
  fun parse(args: List<String>): Request {
    val options = Options.parse(args, valued = setOf("--kind", "--family", "--runtimes"), flags = setOf("--update"))
    val kind = File(options.required("--kind"))
    return Request(
      kind = kind,
      family = options.required("--family"),
      runtimes = options.opt("--runtimes")?.let(::File) ?: KitFolders.runtimesBeside(kind),
      update = options.flag("--update"),
    )
  }

  fun run(request: Request, out: PrintStream, err: PrintStream): Int {
    val manifest = KitFolders.kind(request.kind)
    val runtimes = RuntimeBinding.bind(manifest, KitFolders.runtimes(request.runtimes))
    val plan = if (request.update) {
      InstallRenderer.updatePlan(manifest, runtimes, request.family)
    } else {
      InstallRenderer.plan(manifest, runtimes, request.family)
    }
    if (plan == null) {
      err.println("kit-cli: ${manifest.id} has no ${if (request.update) "update" else "install"}")
      return 1
    }
    out.print(plan.script)
    err.println("kit-cli: ${manifest.id} on ${request.family}: phases ${plan.phases.joinToString()}; timeout ${plan.timeoutSec}s")
    return 0
  }
}
