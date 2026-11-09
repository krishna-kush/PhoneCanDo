package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.manifest.ManifestException
import com.phonecando.agents.kit.render.InstallRenderer
import com.phonecando.agents.kit.render.KindException
import com.phonecando.agents.kit.render.NoRecipe
import com.phonecando.agents.kit.render.RuntimeBinding
import java.io.File
import java.io.PrintStream

// The kit's CLI for CI:
//   kit-cli render-install --kind <dir> --family <f> [--runtimes <dir>] [--update]
// prints a kind's install script (its update with --update) for an image of
// that family, exactly as the phone renders it, on stdout: the raw script,
// for the guest's `sh -s` with HOME the image home. --runtimes is the
// folder of runtime plugins, by default agents/runtimes beside the kind's
// agents/<type>/. Exit codes: 0 the script, 1 nothing to render (no
// install, or no recipe for that family) or a manifest that cannot be read,
// 2 usage; every failure says why on stderr.
object Cli {
  const val USAGE = "usage: kit-cli render-install --kind <dir> --family <family> [--runtimes <dir>] [--update]"

  fun main(args: List<String>, out: PrintStream, err: PrintStream): Int {
    val request = try {
      parse(args)
    } catch (e: IllegalArgumentException) {
      err.println("kit-cli: ${e.message}")
      err.println(USAGE)
      return 2
    }
    if (request == null) {
      out.println(USAGE)
      return 0
    }
    return try {
      render(request, out, err)
    } catch (e: NoRecipe) {
      err.println("kit-cli: ${e.message}")
      1
    } catch (e: ManifestException) {
      err.println("kit-cli: ${e.message}")
      1
    } catch (e: KindException) {
      err.println("kit-cli: ${e.message}")
      1
    }
  }

  /** What render-install was asked for. */
  data class Request(val kind: File, val family: String, val runtimes: File, val update: Boolean)

  /** The request in [args]; null for help. Throws IllegalArgumentException for bad usage. */
  fun parse(args: List<String>): Request? {
    if (args.isEmpty() || args.first() in listOf("help", "--help", "-h")) return null
    require(args.first() == "render-install") { "unknown command ${args.first()}" }
    val options = mutableMapOf<String, String>()
    var update = false
    var i = 1
    while (i < args.size) {
      val name = args[i]
      when {
        name == "--update" -> update = true
        name in VALUED -> options[name] = args.getOrNull(i + 1)?.takeUnless { it.startsWith("--") }
          ?: throw IllegalArgumentException("$name needs a value")
        else -> throw IllegalArgumentException("unknown option $name")
      }
      i += if (name in VALUED) 2 else 1
    }
    val kind = File(options["--kind"] ?: throw IllegalArgumentException("--kind is required"))
    val family = options["--family"] ?: throw IllegalArgumentException("--family is required")
    val runtimes = options["--runtimes"]?.let(::File) ?: KitFolders.runtimesBeside(kind)
    return Request(kind, family, runtimes, update)
  }

  private fun render(request: Request, out: PrintStream, err: PrintStream): Int {
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

  private val VALUED = setOf("--kind", "--family", "--runtimes")
}
