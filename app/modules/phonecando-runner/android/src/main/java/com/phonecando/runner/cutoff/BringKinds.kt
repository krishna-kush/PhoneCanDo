package com.phonecando.runner.cutoff

import android.content.Context
import com.phonecando.agents.kit.manifest.EngineStyle
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.messages.delivery.KindInbox

// What an agent's kind can do to go on in the same chat (BringRules.Kind),
// from its manifest: for a run cut off (CutOffs) and for an agent you
// paused that you start again while its engine is stopped (presence/).
internal object BringKinds {
  /** Null when this build has no such kind. */
  fun of(context: Context, agent: AgentRecord): BringRules.Kind? {
    val kind = KindCatalogs.get(context).get(agent.kind) ?: return null
    return BringRules.Kind(
      server = kind.style == EngineStyle.SERVER,
      acp = kind.speaksAcp,
      prompts = kind.promptsAtStart,
      resumes = kind.manifest.engine?.resume != null,
      wakesByServer = KindInbox.of(kind)?.wakesByServer == true,
    )
  }
}
