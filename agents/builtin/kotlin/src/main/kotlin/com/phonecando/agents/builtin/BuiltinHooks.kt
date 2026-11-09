package com.phonecando.agents.builtin

import com.phonecando.agents.kit.KindHooks
import com.phonecando.agents.opencode.OpencodeHooks

// The code hooks of every bundled kind that has any, by kind id. The runner
// reaches them only through this map; a kind with hooks is one line here,
// and a kind without any needs none.
object BuiltinHooks {
  val all: Map<String, KindHooks> = listOf<KindHooks>(OpencodeHooks).associateBy { it.id }

  /** The kind a fresh install starts with: the one place a default kind is named. */
  const val defaultKindId = "opencode"
}
