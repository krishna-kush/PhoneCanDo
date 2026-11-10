package com.phonecando.agents.kit.cli

import com.phonecando.agents.kit.manifest.ManifestException
import com.phonecando.agents.kit.render.KindException
import com.phonecando.agents.kit.render.NoRecipe
import java.io.PrintStream

// The kit's CLI for CI, one command per file:
//   render-install  a kind's install script, as the phone renders it (RenderInstall)
//   render-model    a kind's one-shot run with a local model, guest side (RenderModel)
// Exit codes: 0 done, 1 nothing to render or a refusal (a manifest that
// cannot be read, no recipe, no wiring for the served APIs), 2 usage; every
// failure says why on stderr.
object Cli {
  val USAGE = "usage:\n  ${RenderInstall.USAGE}\n  ${RenderModel.USAGE}"

  fun main(args: List<String>, out: PrintStream, err: PrintStream, env: (String) -> String? = System::getenv): Int {
    if (args.isEmpty() || args.first() in listOf("help", "--help", "-h")) {
      out.println(USAGE)
      return 0
    }
    val rest = args.drop(1)
    return try {
      when (args.first()) {
        "render-install" -> RenderInstall.run(RenderInstall.parse(rest), out, err)
        "render-model" -> RenderModel.run(RenderModel.parse(rest), env, out, err)
        else -> throw IllegalArgumentException("unknown command ${args.first()}")
      }
    } catch (e: Refused) {
      refused(err, e)
    } catch (e: IllegalArgumentException) {
      // The kit's own failures are IllegalArgumentExceptions too.
      if (e is ManifestException || e is KindException || e is NoRecipe) return refused(err, e)
      err.println("kit-cli: ${e.message}")
      err.println(USAGE)
      2
    }
  }

  private fun refused(err: PrintStream, e: Exception): Int {
    err.println("kit-cli: ${e.message}")
    return 1
  }
}

/** A request this kind cannot answer (exit 1). */
class Refused(message: String) : Exception(message)
