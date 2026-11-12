package com.phonecando.runner.engine.image

import java.io.File

// What PhoneCanDo tells every agent about itself, in the agent's
// instructions file between two marker lines (MarkedBlock): what PhoneCanDo
// is and where the agent runs, its machine (Linux, or Android without
// Linux) and, for a kind with the phone tools, how to use them (phone
// control on full builds, the basic tools on the others) and the other
// agents. The text is agents/shared/phonecando-note/ (packaged by
// agents.gradle, read through [body]'s `read`), with {{name}} and {{kind}}
// filled in. Each engine start replaces the block, so a rename shows from
// the next start; with no parts packaged the block goes. Pure JVM.
object PhoneCanDoNote {
  const val BEGIN = "<!-- phonecando:about -->"
  const val END = "<!-- /phonecando:about -->"

  /** Where agents.gradle packages the parts. */
  const val ASSET_DIR = "agents/shared/phonecando-note"

  private val block = MarkedBlock(BEGIN, END)

  /** The agent as the note tells it: its name, its kind's label, its machine, the build and its tools. */
  data class Facts(
    val name: String,
    val kind: String,
    val linux: Boolean,
    val full: Boolean,
    val phoneTools: Boolean,
  )

  /** The parts this agent gets, in order. */
  fun parts(f: Facts): List<String> = buildList {
    add("about.md")
    add(if (f.linux) "machine-linux.md" else "machine-android.md")
    if (f.phoneTools) {
      add(if (f.full) "phone-control.md" else "phone-basic.md")
      add("agents.md")
    }
  }

  /** The note from the parts [read] gives (one it cannot read is left out); null when none is there. */
  fun body(f: Facts, read: (name: String) -> String?): String? {
    val text = parts(f).mapNotNull { read(it)?.trim()?.takeIf(String::isNotEmpty) }
    if (text.isEmpty()) return null
    return text.joinToString("\n\n").replace("{{kind}}", f.kind).replace("{{name}}", f.name)
  }

  /** Writes [instructions] only when its text changes. */
  fun apply(instructions: File, body: String?) = block.apply(instructions, body)
}
