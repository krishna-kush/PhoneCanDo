package com.phonecando.runner.engine.work

import com.phonecando.runner.engine.proc.ProcDetail

// A job's short name for the notification, from its command line: the
// program and up to two words after it ("npm run dev", "python3 -m
// http.server", "sleep 600"), a script's name instead of its interpreter
// ("node /x/vite.js" is "vite.js"). It stops at a word that may carry a
// value (KEY=…, --token=…) or is long, so a secret on the command line
// stays out of it. Pure.
object WorkNames {
  fun of(p: ProcDetail): String {
    val args = p.argv.filter { it.isNotEmpty() }
    if (args.isEmpty()) return p.name ?: "a process"
    val rest = if (INTERPRETER.matches(base(args[0])) && args.size > 1 && !args[1].startsWith("-")) args.drop(1) else args
    val words = arrayListOf(base(rest[0]).removePrefix("-"))
    for (a in rest.drop(1)) {
      if (words.size == MAX_WORDS || '=' in a || a.length > MAX_WORD) break
      words += if (a.startsWith("/")) base(a) else a
    }
    return words.joinToString(" ").take(MAX_LEN)
  }

  private fun base(path: String) = path.trimEnd('/').substringAfterLast('/')

  private val INTERPRETER = Regex("(node|nodejs|bun|deno|python[0-9.]*|ruby|perl|php)")
  private const val MAX_WORDS = 3
  private const val MAX_WORD = 32
  private const val MAX_LEN = 40
}
